"""Generate local teacher-reviewed reports from exact grades, answers and question versions."""

import hashlib
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from .database import audit, encode, new_id
from . import exam_print
from .exams import get_paper
from .files import check_owned_export, store_bytes
from .grading import get_draft, get_grade
from .models import DomainError, Identifier
from .records import get_record
from .submissions import get_submission


class GradeExport(Identifier):
    format: Literal["docx", "pdf"]


def _answer_text(answer):
    if answer["kind"] in {"single_choice", "multiple_choice"}:
        return "、".join(answer["selected_ids"]) or "未作答"
    if answer["kind"] == "true_false":
        return "未作答" if answer["answer"] is None else "正确" if answer["answer"] else "错误"
    if answer["kind"] == "fill_blank":
        return "\n".join(f"第{index}空　{value or '未作答'}" for index, value in enumerate(answer["values"], 1))
    return answer["text"] or "未作答"


def _content(conn, grade):
    submission = get_submission(conn, Identifier(id=grade["submission_id"]))
    draft = get_draft(conn, Identifier(id=grade["draft_id"]))
    paper = get_paper(conn, Identifier(id=grade["paper_id"]))
    course = get_record(conn, "course", paper["plan"]["course_id"])
    student = get_record(conn, "student", grade["student_id"])
    group = get_record(conn, "class", grade["class_id"])
    content = exam_print.print_content(paper, "teacher", course["title"])
    reviewed_at = datetime.fromisoformat(grade["created_at"]).astimezone(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S")
    content.update(title=paper["title"] + "批改报告", metadata=f"课程 {course['title']}　试卷版本{paper['version']}　教材 {paper['plan']['scope']['textbook_title']} v{paper['plan']['scope']['textbook_version']}",
        identity_line=f"学生 {student['name']}　学号 {student['student_number']}　答卷班级 {group['name']}",
        instructions=f"教师复核得分 {grade['total_points_centi'] / 100:.2f}分　满分 {paper['plan']['config']['total_points_centi'] / 100:.2f}分",
        intro_lines=[f"答卷版本{submission['version']}　评分草稿版本{draft['version']}　复核时间 {reviewed_at}（北京时间）",
                     "教师复核说明　" + grade["note"], "成绩记录　" + grade["id"]])
    answers = {item["question_id"]: item["content"] for item in submission["answers"]}
    scores = {item["question_id"]: item for item in grade["scores"]}
    proposals = {item["question_id"]: item for item in draft["report"]["scores"]}
    for question, printed in zip(paper["questions"], content["questions"]):
        score, proposal = scores[question["id"]], proposals[question["id"]]
        lost = question["points_centi"] - score["points_centi"]
        printed["heading"] += f"　得分 {score['points_centi'] / 100:.2f}分　失分 {lost / 100:.2f}分"
        printed["options"].append("学生作答　" + _answer_text(answers[question["id"]]))
        if proposal["automatic_points_centi"] is not None:
            printed["options"].append(f"本地自动评分　{proposal['automatic_points_centi'] / 100:.2f}分")
        if proposal["confidence"] is not None:
            printed["options"].append(f"模型辅助建议　{proposal['proposed_points_centi'] / 100:.2f}分　置信度 {proposal['confidence'] * 100:.0f}%")
        if score["comment"]:
            printed["options"].append("教师评分意见　" + score["comment"])
        printed["teacher"]["rubric"] = [f"{item['label']}　得分 {award / 100:.2f}分　满分 {item['points_centi'] / 100:.2f}分"
            for item, award in zip(question["content"].get("rubric", []), score["rubric_awards"])]
    return content


def export(conn, data, actor):
    grade = get_grade(conn, data)
    content = _content(conn, grade)
    source_hash = hashlib.sha256(encode(content).encode()).hexdigest()
    cached = conn.execute("SELECT * FROM grade_exports WHERE grade_id=? AND format=? AND source_hash=?", (data.id, data.format, source_hash)).fetchone()
    if cached:
        return check_owned_export(dict(cached), "批改报告")
    output = exam_print.build(content, data.format)
    path, digest = store_bytes(output, "." + data.format)
    identifier = new_id()
    filename = f"批改报告-{data.id[:8]}-{source_hash[:8]}.{data.format}"
    conn.execute("INSERT INTO grade_exports(id,grade_id,format,source_hash,stored_path,sha256,byte_size,filename) VALUES(?,?,?,?,?,?,?,?)",
        (identifier, data.id, data.format, source_hash, str(path), digest, len(output), filename))
    result = dict(conn.execute("SELECT * FROM grade_exports WHERE id=?", (identifier,)).fetchone())
    audit(conn, "grade", data.id, "export_report_" + data.format, actor, None, result)
    return result


def download(conn, data):
    row = conn.execute("SELECT * FROM grade_exports WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "批改报告导出记录不存在")
    result = check_owned_export(dict(row), "批改报告")
    return {key: result[key] for key in ("stored_path", "filename", "sha256")}
