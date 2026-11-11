"""Exact exam constraints, reviewed exports, native generation persistence and progress scope."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sqlite3

from tests.extensions.test_teacher_documents import lesson_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_questions import question_params
from tests.extensions.test_teacher_timetable import calendar_workspace

__all__ = ["calendar_workspace", "teacher"]


def exam_params(lesson, kinds=("single_choice",)):
    return {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "title": "虚构课程命题验证",
        "config": {"question_types": [{"kind": kind, "count": 1} for kind in kinds], "total_points_centi": len(kinds) * 500,
                   "duration_minutes": 90, "student_level": "职业教育一年级，已掌握基础概念"}}


def test_exam_version_review_export_audience_and_integrity(teacher, tmp_path):
    from docx import Document
    from pypdf import PdfReader

    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    kinds = ("single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer")
    plan = saved(call, "exam.plan.save", exam_params(lesson, kinds))
    questions = []
    for kind in kinds:
        params = question_params(lesson, kind)
        params["content"]["prompt"] += f"（{kind}测试题）"
        params["content"]["explanation"] = "教师解析标记仅用于测试隔离"
        questions.append(saved(call, "question.save", params))
    paper_data = {"plan_id": plan["id"], "title": "虚构学生测试试卷", "question_ids": [question["id"] for question in questions]}
    paper = saved(call, "exam.paper.save", paper_data, "paper-once")
    assert paper["report"]["total_points_centi"] == 2500
    assert tool("exam.paper.get", {"id": paper["id"]}, name="teacher_assessment")["data"]["id"] == paper["id"]
    assert saved(call, "exam.paper.save", paper_data, "paper-once")["id"] == paper["id"]
    assert call("exam.paper.review", {"id": paper["id"], "decision": "approved"}, "too-early")["error"]["code"] == "review_required"
    assert call("exam.export", {"id": paper["id"], "audience": "student", "format": "docx"}, "draft-export")["error"]["code"] == "review_required"
    for question in questions:
        saved(call, "question.review", {"id": question["id"], "decision": "approved"})
    assert not tool("exam.paper.review", {"id": paper["id"], "decision": "approved"}, "agent-review", name="teacher_assessment")["ok"]
    reviewed = saved(call, "exam.paper.review", {"id": paper["id"], "decision": "approved", "note": "核对题目与评分标准"})
    assert reviewed["reviewed_by"] == "desktop:teacher"
    exported = {}
    for audience in ("student", "teacher"):
        for format_ in ("docx", "pdf"):
            data = {"id": paper["id"], "audience": audience, "format": format_}
            asset = saved(call, "exam.export", data)
            assert saved(call, "exam.export", data)["id"] == asset["id"]
            assert call("exam.export.file", {"id": asset["id"]})["data"]["sha256"] == asset["sha256"]
            path = Path(asset["stored_path"])
            if format_ == "docx":
                document = Document(path)
                text = "\n".join(paragraph.text for paragraph in document.paragraphs)
                assert len(document.inline_shapes) == 0
            else:
                pdf = PdfReader(path)
                text = "\n".join(page.extract_text() for page in pdf.pages)
                assert len(pdf.pages) >= 1
            assert "虚构学生测试试卷" in text and "25分" in text and "90分钟" in text
            assert ("教师解析标记仅用于测试隔离" in text) == (audience == "teacher")
            assert ("参考答案" in text) == (audience == "teacher")
            assert ("评分要点" in text) == (audience == "teacher")
            assert ("教材依据" in text) == (audience == "teacher")
            exported[audience, format_] = asset
    revised = saved(call, "exam.paper.save", {**paper_data, "root_id": paper["root_id"], "expected_version": 1, "title": "试卷第二版本"})
    assert revised["version"] == 2 and revised["status"] == "draft"
    assert call("exam.paper.get", {"id": paper["id"]})["data"]["status"] == "approved"
    asset = exported["student", "docx"]
    Path(asset["stored_path"]).write_bytes(b"damaged")
    assert call("exam.export.file", {"id": asset["id"]})["error"]["code"] == "file_integrity_error"
    assert call("exam.export", {"id": paper["id"], "audience": "student", "format": "docx"}, "bad-cache")["error"]["code"] == "file_integrity_error"


def test_exam_constraints_knowledge_scope_and_concurrent_revisions(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    points = call("knowledge.list", {"version_id": lesson["version_id"], "limit": 200})["data"]["items"]
    point = next(point for point in points if point["source_id"] == lesson["sources"][0]["id"])
    params = exam_params(lesson)
    params["config"].update(knowledge_point_ids=[point["id"]], coverage_percent=100, difficulties=[{"difficulty": "medium", "count": 1}])
    plan = saved(call, "exam.plan.save", params)
    question_data = question_params(lesson)
    question = saved(call, "question.save", question_data)
    data = {"plan_id": plan["id"], "title": "约束检查试卷", "question_ids": [question["id"]]}
    assert call("exam.paper.save", data, "missing-coverage")["error"]["code"] == "exam_constraint_failed"
    question_data["content"]["knowledge_point_ids"] = [point["id"]]
    question = saved(call, "question.save", {**question_data, "root_id": question["root_id"], "expected_version": 1})
    data["question_ids"] = [question["id"]]
    paper = saved(call, "exam.paper.save", data)
    assert paper["report"]["coverage_percent"] == 100
    assert call("exam.paper.save", {**data, "question_ids": [question["id"], question["id"]]}, "duplicates")["error"]["code"] == "duplicate_questions"
    for update in ({"total_points_centi": 501}, {"question_types": [{"kind": "short_answer", "count": 1}]}, {"difficulties": [{"difficulty": "hard", "count": 1}]}):
        invalid_plan = saved(call, "exam.plan.save", {**params, "config": params["config"] | update})
        assert call("exam.paper.save", {**data, "plan_id": invalid_plan["id"]}, "mismatch-" + next(iter(update)))["error"]["code"] == "exam_constraint_failed"
    revision = {**params, "root_id": plan["root_id"], "expected_version": 1}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda request: call("exam.plan.save", revision, request), ["plan-a", "plan-b"]))
    assert sum(result["ok"] for result in results) == 1
    assert next(result for result in results if not result["ok"])["error"]["code"] == "version_conflict"
    assert call("exam.plan.list", {"course_id": lesson["course_id"], "limit": 2})["data"]["next_offset"] == 2
    assert call("exam.paper.list", {"course_id": lesson["course_id"]})["data"]["total"] == 1
    foreign = lesson_fixture(call, tmp_path)
    assert call("exam.plan.save", {**params, "textbook_version_id": foreign["version_id"]}, "foreign-book")["error"]["code"] == "association_conflict"
    assert call("exam.plan.save", {**params, "config": params["config"] | {"chapter_ids": ["missing"]}}, "foreign-chapter")["error"]["code"] == "association_conflict"
    assert call("exam.plan.save", {**params, "config": params["config"] | {"knowledge_point_ids": ["missing"]}}, "foreign-point")["error"]["code"] == "association_conflict"


def test_exam_native_generation_cancel_review_and_connection_persistence(teacher, tmp_path):
    home, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    plan = saved(call, "exam.plan.save", exam_params(lesson))
    assert call("exam.generation.begin", {"id": plan["id"]}, "no-authorization")["error"]["code"] == "model_call_not_authorized"
    generation = saved(call, "exam.generation.begin", {"id": plan["id"], "allow_model_call": True})
    assert generation["task"]["status"] == "pending" and "exam.paper.save" in generation["prompt"]
    claimed = saved(call, "exam.generation.claim", {"id": generation["workflow_id"], "runtime_session_id": "native-session", "stored_session_id": "stored-session"})
    assert claimed["task"]["status"] == "running"
    question = saved(call, "question.save", question_params(lesson))
    data = {"plan_id": plan["id"], "title": plan["title"], "question_ids": [question["id"]], "generation_id": generation["workflow_id"]}
    paper = tool("exam.paper.save", data, "generated-paper", name="teacher_assessment")
    assert paper["ok"], paper
    task = call("exam.generation.get", {"id": generation["workflow_id"]})["data"]
    assert task["paper_id"] == paper["data"]["id"] and task["task"]["status"] == "awaiting_review"
    with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
        assert conn.execute("SELECT stored_session_id FROM exam_generations WHERE workflow_id=?", (generation["workflow_id"],)).fetchone()[0] == "stored-session"
        assert not conn.execute("PRAGMA foreign_key_check").fetchall()
    revised = saved(call, "exam.paper.save", {"plan_id": plan["id"], "title": "教师修订生成试卷", "question_ids": [question["id"]], "root_id": paper["data"]["root_id"], "expected_version": 1})
    assert call("exam.generation.get", {"id": generation["workflow_id"]})["data"]["paper_id"] == revised["id"]
    saved(call, "question.review", {"id": question["id"], "decision": "approved"})
    saved(call, "exam.paper.review", {"id": revised["id"], "decision": "approved"})
    assert call("exam.generation.get", {"id": generation["workflow_id"]})["data"]["task"]["status"] == "completed"
    cancelled = saved(call, "exam.generation.begin", {"id": plan["id"], "allow_model_call": True})
    running = saved(call, "exam.generation.claim", {"id": cancelled["workflow_id"], "runtime_session_id": "cancel-session", "stored_session_id": "cancel-stored"})
    saved(call, "task.cancel", {"id": cancelled["workflow_id"], "version": running["task"]["version"]})
    assert call("exam.paper.save", {**data, "generation_id": cancelled["workflow_id"]}, "cancelled-result")["error"]["code"] == "invalid_transition"
    assert call("exam.paper.list", {"course_id": lesson["course_id"]})["data"]["total"] == 2


def test_exam_completed_progress_is_a_fixed_source_snapshot(calendar_workspace):
    call, lesson, _, semester = calendar_workspace
    params = exam_params(lesson)
    params["config"]["completed_only"] = True
    assert call("exam.plan.save", params, "no-progress")["error"]["code"] == "empty_scope"
    publication = saved(call, "plan.publish", {"id": semester["id"], "review_note": "虚构课表范围测试"})
    event = publication["events"][0]
    progress = {"id": event["id"], "publication_id": publication["id"], "version": event["version"], "status": "completed",
                "actual_minutes": 80, "lesson_id": lesson["id"], "note": "已完成测试课次"}
    completed = saved(call, "calendar.progress", progress)
    plan = saved(call, "exam.plan.save", params)
    assert plan["scope"]["source_ids"] == [lesson["sources"][0]["id"]]
    assert plan["scope"]["progress_events"][0]["version"] == completed["version"]
    saved(call, "calendar.progress", {**progress, "version": completed["version"], "status": "scheduled", "actual_minutes": None})
    assert call("exam.plan.get", {"id": plan["id"]})["data"]["scope"] == plan["scope"]
    assert call("exam.plan.save", {**params, "root_id": plan["root_id"], "expected_version": 1}, "refresh-progress")["error"]["code"] == "empty_scope"
