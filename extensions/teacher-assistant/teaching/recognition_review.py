"""Compose page evidence into an editable answer form and retain teacher corrections."""

from .answer_assets import get_file
from .database import audit, encode
from .exams import get_paper
from .grading_models import SubmissionSave
from .models import DomainError, Identifier
from .recognition import get_job
from .recognition_models import RecognitionSelection
from . import submissions


REVIEW_THRESHOLD = 0.8


def _empty(question):
    kind = question["kind"]
    fields = {"single_choice": {"selected_ids": []}, "multiple_choice": {"selected_ids": []},
        "true_false": {"answer": None}, "fill_blank": {"values": [""] * len(question["content"].get("blanks", []))},
        "short_answer": {"text": ""}}
    return {"kind": kind, **fields[kind]}


def _merge(question, entries):
    if not entries:
        return _empty(question), True, "所选页面没有定位到该题作答，请核对或补全"
    contents = {encode(item["content"]) for item in entries}
    uncertain = any(item["confidence"] < REVIEW_THRESHOLD for item in entries)
    if len(contents) == 1:
        return entries[0]["content"], uncertain, "识别置信度不足，请核对原页" if uncertain else ""
    if question["kind"] == "short_answer":
        return {"kind": "short_answer", "text": "\n".join(item["content"]["text"] for item in entries)}, True, "该题跨页合并，请核对文字顺序及重复内容"
    return _empty(question), True, "所选页面的该题结果不一致，请对照原页填写答案"


def compose(conn, data):
    file = get_file(conn, data)
    paper = get_paper(conn, Identifier(id=file["paper_id"]))
    if len(data.job_ids) != len(set(data.job_ids)):
        raise DomainError("invalid_selection", "识别任务不能重复选择")
    jobs = [get_job(conn, Identifier(id=identifier)) for identifier in data.job_ids]
    if any(job["file_id"] != data.id or job["state"] != "succeeded" for job in jobs):
        raise DomainError("association_conflict", "请选择当前答卷文件中成功完成的识别任务")
    if len({job["page_number"] for job in jobs}) != len(jobs):
        raise DomainError("invalid_selection", "每页请选择一次识别结果进行合并校对")
    jobs.sort(key=lambda job: job["page_number"])
    grouped = {}
    unassigned = []
    for job in jobs:
        for answer in job["result"]["answers"]:
            grouped.setdefault(answer["question_id"], []).append(answer)
        if job["result"].get("unassigned_text"):
            unassigned.append({"page_number": job["page_number"], "text": job["result"]["unassigned_text"]})
    answers, warnings = [], []
    for question in paper["questions"]:
        content, uncertain, message = _merge(question, grouped.get(question["id"], []))
        answers.append({"question_id": question["id"], "content": content})
        if uncertain:
            warnings.append({"question_id": question["id"], "message": message})
    latest = conn.execute("SELECT COALESCE(MAX(version),0) FROM answer_submissions WHERE paper_id=? AND student_id=?",
        (file["paper_id"], file["student_id"])).fetchone()[0]
    return {"file_id": data.id, "paper_id": file["paper_id"], "student_id": file["student_id"], "expected_version": latest, "answers": answers,
        "warnings": warnings, "unassigned": unassigned, "review_required": bool(warnings or unassigned), "confidence_threshold": REVIEW_THRESHOLD,
        "source_jobs": [{"id": job["id"], "page_number": job["page_number"]} for job in jobs]}


def apply(conn, data, actor):
    proposal = compose(conn, RecognitionSelection(id=data.file_id, job_ids=data.job_ids))
    if proposal["paper_id"] != data.paper_id or proposal["student_id"] != data.student_id:
        raise DomainError("association_conflict", "识别校对需对应当前答卷文件绑定的试卷与学生")
    if proposal["review_required"] and not data.reviewed_uncertain:
        raise DomainError("recognition_review_required", "请先对照原页复核低置信、跨页合并及待补全内容，再保存校对答卷")
    payload = SubmissionSave.model_validate(data.model_dump(exclude={"file_id", "job_ids", "reviewed_uncertain"}))
    saved = submissions.save(conn, payload, actor)
    conn.executemany("INSERT INTO submission_recognitions(submission_id,job_id,reviewed_by,reviewed_uncertain) VALUES(?,?,?,?)",
        [(saved["id"], identifier, actor, int(data.reviewed_uncertain)) for identifier in data.job_ids])
    result = submissions.get_submission(conn, Identifier(id=saved["id"]))
    audit(conn, "submission", saved["id"], "review_page_transcription", actor,
        {"proposal": proposal}, {"job_ids": data.job_ids, "reviewed_uncertain": data.reviewed_uncertain, "submission_id": saved["id"]})
    return result
