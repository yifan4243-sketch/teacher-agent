"""Local answer versions require the existing enrollment and course-class relationships."""

import json

from .database import audit, encode, new_id
from .exams import get_paper
from .models import DomainError, Identifier
from .records import require_active


def check_student(conn, course_id, student_id):
    require_active(conn, "course", course_id)
    student = require_active(conn, "student", student_id)
    require_active(conn, "class", student["class_id"])
    enrolled = conn.execute("SELECT 1 FROM enrollments WHERE course_id=? AND student_id=?", (course_id, student_id)).fetchone()
    linked = conn.execute("SELECT 1 FROM course_classes WHERE course_id=? AND class_id=?", (course_id, student["class_id"])).fetchone()
    if not enrolled or not linked:
        raise DomainError("association_conflict", "学生需已选该课程，且所属班级已关联该课程")
    return student


def get_submission(conn, data):
    row = conn.execute("SELECT * FROM answer_submissions WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "答卷版本不存在")
    result = dict(row)
    result["answers"] = json.loads(result.pop("answers_json"))
    result["latest_version"] = conn.execute("SELECT MAX(version) FROM answer_submissions WHERE root_id=?", (result["root_id"],)).fetchone()[0]
    latest = conn.execute("SELECT id FROM grade_drafts WHERE submission_id=? ORDER BY version DESC LIMIT 1", (data.id,)).fetchone()
    result["latest_draft_id"] = latest[0] if latest else None
    return result


def list_submissions(conn, data):
    get_paper(conn, data)
    rows = conn.execute("""SELECT a.id,a.root_id,a.version,a.student_id,a.class_id,a.note,a.created_at,s.name,s.student_number
        FROM answer_submissions a JOIN students s ON s.id=a.student_id WHERE a.paper_id=?
        ORDER BY a.rowid DESC LIMIT ? OFFSET ?""", (data.id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM answer_submissions WHERE paper_id=?", (data.id,)).fetchone()[0]
    return {"items": [dict(row) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def _validate_answers(paper, answers):
    expected = {question["id"]: question for question in paper["questions"]}
    if len(answers) != len(expected) or {item.question_id for item in answers} != set(expected):
        raise DomainError("invalid_answers", "答卷需要逐一包含该试卷的全部题目版本，未作答题目填写空答案")
    for item in answers:
        question, answer = expected[item.question_id]["content"], item.content
        if answer.kind != question["kind"]:
            raise DomainError("invalid_answers", "答案类型需与对应题型一致")
        if answer.kind in {"single_choice", "multiple_choice"}:
            ids = answer.selected_ids
            if len(ids) != len(set(ids)) or not set(ids) <= {option["id"] for option in question["options"]} or answer.kind == "single_choice" and len(ids) > 1:
                raise DomainError("invalid_answers", "选择题答案需使用试卷中的唯一选项标识，单选最多选一项")
        if answer.kind == "fill_blank" and len(answer.values) != len(question["blanks"]):
            raise DomainError("invalid_answers", "填空答案数量需与试题空位数量一致")
        if answer.kind == "fill_blank" and any(len(value) > 2000 for value in answer.values):
            raise DomainError("invalid_answers", "每空答案最多2000字符")


def save(conn, data, actor):
    paper = get_paper(conn, Identifier(id=data.paper_id))
    if paper["status"] != "approved":
        raise DomainError("review_required", "请先审核正式试卷，再关联学生答卷")
    student = check_student(conn, paper["plan"]["course_id"], data.student_id)
    previous = conn.execute("SELECT id,root_id,version FROM answer_submissions WHERE paper_id=? AND student_id=? ORDER BY version DESC LIMIT 1", (data.paper_id, data.student_id)).fetchone()
    if data.expected_version != (previous["version"] if previous else 0):
        raise DomainError("version_conflict", "学生答卷已有新版本，请刷新后更正")
    _validate_answers(paper, data.answers)
    identifier = new_id()
    conn.execute("""INSERT INTO answer_submissions(id,root_id,parent_id,version,paper_id,student_id,class_id,answers_json,note,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?)""", (identifier, previous["root_id"] if previous else identifier, previous["id"] if previous else None,
        data.expected_version + 1, data.paper_id, data.student_id, student["class_id"], encode([item.model_dump() for item in data.answers]), data.note, actor))
    result = get_submission(conn, Identifier(id=identifier))
    audit(conn, "submission", identifier, "save_version", actor, dict(previous) if previous else None, result)
    return result
