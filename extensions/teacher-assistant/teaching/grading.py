"""Append-only score drafts and transactional teacher publication of official grades."""

import json

from .database import audit, encode, new_id
from .exams import get_paper
from .models import DomainError, Identifier
from . import scoring
from .submissions import check_student, get_submission


def get_draft(conn, data):
    row = conn.execute("SELECT * FROM grade_drafts WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "评分草稿不存在")
    result = dict(row)
    result["report"] = json.loads(result.pop("report_json"))
    result["latest_version"] = conn.execute("SELECT MAX(version) FROM grade_drafts WHERE submission_id=?", (result["submission_id"],)).fetchone()[0]
    submission = get_submission(conn, Identifier(id=result["submission_id"]))
    current = current_grade(conn, submission["paper_id"], submission["student_id"])
    result["current_grade_id"] = current["id"] if current else None
    published = conn.execute("SELECT id FROM grade_publications WHERE draft_id=?", (data.id,)).fetchone()
    result["published_grade_id"] = published[0] if published else None
    return result


def _save_draft(conn, submission, report, expected_version, actor):
    if submission["version"] != submission["latest_version"]:
        raise DomainError("version_conflict", "该答卷已有更正版本，请核对最新答卷后评分")
    previous = conn.execute("SELECT id,version FROM grade_drafts WHERE submission_id=? ORDER BY version DESC LIMIT 1", (submission["id"],)).fetchone()
    if expected_version != (previous["version"] if previous else 0):
        raise DomainError("version_conflict", "评分草稿已有新版本，请刷新后继续")
    identifier = new_id()
    conn.execute("INSERT INTO grade_drafts(id,submission_id,version,parent_id,report_json,created_by) VALUES(?,?,?,?,?,?)",
        (identifier, submission["id"], expected_version + 1, previous["id"] if previous else None, encode(report), actor))
    result = get_draft(conn, Identifier(id=identifier))
    audit(conn, "grade_draft", identifier, "save_version", actor, dict(previous) if previous else None, result)
    return result


def score_submission(conn, data, actor):
    submission = get_submission(conn, data)
    paper = get_paper(conn, Identifier(id=submission["paper_id"]))
    check_student(conn, paper["plan"]["course_id"], submission["student_id"])
    return _save_draft(conn, submission, scoring.score(paper, submission), data.expected_version, actor)


def current_grade(conn, paper_id, student_id):
    row = conn.execute("SELECT id FROM grade_publications WHERE paper_id=? AND student_id=? AND active=1", (paper_id, student_id)).fetchone()
    return get_grade(conn, Identifier(id=row[0])) if row else None


def get_grade(conn, data):
    row = conn.execute("SELECT * FROM grade_publications WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "正式成绩记录不存在")
    result = dict(row)
    result["scores"] = json.loads(result.pop("scores_json"))
    result["wrong_questions"] = [dict(item) for item in conn.execute("SELECT question_id,lost_points_centi FROM grade_wrong_questions WHERE grade_id=? ORDER BY question_id", (data.id,))]
    return result


def list_grades(conn, data):
    parameters = (data.course_id, data.student_id, data.student_id, data.paper_id, data.paper_id)
    where = "s.course_id=? AND g.active=1 AND (? IS NULL OR g.student_id=?) AND (? IS NULL OR g.paper_id=?)"
    joins = "FROM grade_publications g JOIN exam_papers p ON p.id=g.paper_id JOIN exam_plans s ON s.id=p.plan_id JOIN students st ON st.id=g.student_id"
    rows = conn.execute(f"SELECT g.id,g.paper_id,g.student_id,g.class_id,g.total_points_centi,g.created_at,st.name,st.student_number,p.title {joins} WHERE {where} ORDER BY g.rowid DESC LIMIT ? OFFSET ?", (*parameters, data.limit, data.offset)).fetchall()
    total = conn.execute(f"SELECT COUNT(*) {joins} WHERE {where}", parameters).fetchone()[0]
    return {"items": [dict(row) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def publish(conn, data, actor):
    draft = get_draft(conn, data)
    submission = get_submission(conn, Identifier(id=draft["submission_id"]))
    paper = get_paper(conn, Identifier(id=submission["paper_id"]))
    check_student(conn, paper["plan"]["course_id"], submission["student_id"])
    if draft["version"] != draft["latest_version"] or submission["version"] != submission["latest_version"]:
        raise DomainError("version_conflict", "答卷或评分已有新版本，请核对后再发布成绩")
    scoring.validate_scores(paper, data.scores)
    automatic = {item["question_id"]: item["automatic_points_centi"] for item in draft["report"]["scores"]}
    if any(automatic[item.question_id] is not None and item.points_centi != automatic[item.question_id] and not item.comment for item in data.scores):
        raise DomainError("review_note_required", "调整客观题自动得分时需填写该题复核原因")
    previous = current_grade(conn, submission["paper_id"], submission["student_id"])
    if data.expected_current_grade_id != (previous["id"] if previous else None):
        raise DomainError("version_conflict", "该学生正式成绩已有更新，请刷新后复核")
    if conn.execute("SELECT 1 FROM grade_publications WHERE draft_id=?", (data.id,)).fetchone():
        raise DomainError("invalid_transition", "该评分草稿已发布，请保存新的评分或答卷版本后更正")
    identifier = new_id()
    score_map = {item.question_id: item for item in data.scores}
    ordered_scores = [score_map[question["id"]] for question in paper["questions"]]
    if previous:
        conn.execute("UPDATE grade_publications SET active=0 WHERE id=?", (previous["id"],))
    total = sum(item.points_centi for item in data.scores)
    conn.execute("""INSERT INTO grade_publications(id,paper_id,student_id,class_id,submission_id,draft_id,previous_id,
        total_points_centi,scores_json,note,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        (identifier, submission["paper_id"], submission["student_id"], submission["class_id"], submission["id"], data.id,
        previous["id"] if previous else None, total, encode([item.model_dump() for item in ordered_scores]), data.note, actor))
    maximum = {question["id"]: question["points_centi"] for question in paper["questions"]}
    conn.executemany("INSERT INTO grade_wrong_questions VALUES(?,?,?)", [(identifier, item.question_id, maximum[item.question_id] - item.points_centi)
        for item in data.scores if item.points_centi < maximum[item.question_id]])
    conn.execute("""UPDATE workflows SET status='completed',version=version+1 WHERE id IN
        (SELECT workflow_id FROM grading_generations WHERE result_draft_id=?) AND status='awaiting_review'""", (data.id,))
    result = get_grade(conn, Identifier(id=identifier))
    audit(conn, "grade", identifier, "teacher_publish", actor, previous, result)
    return result
