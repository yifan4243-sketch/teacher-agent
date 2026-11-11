"""Real semester dates, weighted chapter allocation and distinct classroom/exam time."""

from copy import deepcopy
from datetime import datetime
import hashlib
import importlib
import json

from tests.extensions.test_teacher_documents import lesson_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool

__all__ = ["teacher"]


def test_semester_dates_holidays_periods_exam_and_immutable_recalculation(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    book = call("textbook.version", {"id": lesson["version_id"]})["data"]
    chapters = [chapter for chapter in book["chapters"] if chapter["parent_id"] is not None]
    params = {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "title": "虚构测试学期",
        "start_date": "2026-11-02", "end_date": "2026-11-30", "weekly_slots": [{"weekday": 0, "start_time": "08:20"}, {"weekday": 2, "start_time": "14:00"}],
        "excluded_dates": ["2026-11-11"], "chapters": [{"chapter_id": chapter["id"], "difficulty": index + 1} for index, chapter in enumerate(chapters)],
        "review_sessions": 1, "practice_sessions": 1, "exam_sessions": 1, "exam_minutes": 120}
    response = tool("plan.save", params, "semester-once")
    assert response["ok"], response
    plan = response["data"]
    assert plan["totals"] == {"sessions": 8, "instruction_minutes": 560, "assessment_minutes": 120, "calendar_minutes": 750}
    assert tool("plan.save", params, "semester-once")["data"]["id"] == plan["id"]
    assert all(not session["starts_at"].startswith("2026-11-11") for session in plan["sessions"])
    first = plan["sessions"][0]
    assert [(part["kind"], part["start"][11:16], part["end"][11:16]) for part in first["periods"]] == [
        ("teaching", "08:20", "09:00"), ("break", "09:00", "09:10"), ("teaching", "09:10", "09:50")]
    exam = plan["sessions"][-1]
    assert exam["kind"] == "exam" and exam["instruction_minutes"] == 0
    assert len(exam["periods"]) == 1 and (datetime.fromisoformat(exam["ends_at"]) - datetime.fromisoformat(exam["starts_at"])).total_seconds() == 7200
    assert len(plan["months"]["2026-11"]) == 8 and sum(map(len, plan["weeks"].values())) == 8
    assert {session["chapter_id"] for session in plan["sessions"] if session["kind"] == "teaching"} == {chapter["id"] for chapter in chapters}
    assert [sum(session["chapter_id"] == chapter["id"] for session in plan["sessions"]) for chapter in chapters] == [2, 3]
    changed = saved(call, "plan.save", {**params, "parent_id": plan["id"], "excluded_dates": []})
    assert changed["version"] == 2 and changed["root_id"] == plan["id"] and changed["totals"]["sessions"] == 9
    assert call("plan.get", {"id": plan["id"]})["data"]["totals"]["sessions"] == 8
    assert call("plan.save", {**params, "parent_id": plan["id"]}, "stale-plan")["error"]["code"] == "version_conflict"


def test_planning_rejects_overlapping_slots_wrong_sources_and_insufficient_calendar(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    params = {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "title": "约束测试",
        "start_date": "2026-11-02", "end_date": "2026-11-30", "weekly_slots": [{"weekday": 0, "start_time": "08:20"}]}
    duplicate = deepcopy(params)
    duplicate["weekly_slots"] *= 2
    assert call("plan.save", duplicate, "duplicate-slots")["error"]["code"] == "invalid_input"
    overlap = {**params, "weekly_slots": [*params["weekly_slots"], {"weekday": 0, "start_time": "09:00"}]}
    assert call("plan.save", overlap, "overlapping-slots")["error"]["code"] == "schedule_conflict"
    assert call("plan.save", {**params, "exam_sessions": 20}, "insufficient-time")["error"]["code"] == "insufficient_sessions"
    assert call("plan.save", {**params, "chapters": []}, "no-chapters")["error"]["code"] == "no_chapters"
    course = saved(call, "course.create", {"title": "另一课程"})
    assert call("plan.save", {**params, "course_id": course["id"]}, "wrong-course-plan")["error"]["code"] == "association_conflict"
    assert call("plan.save", {**params, "weekly_slots": [{"weekday": 0, "start_time": "23:20"}]}, "midnight-plan")["error"]["code"] == "schedule_conflict"
    assert call("plan.list", {"course_id": lesson["course_id"]})["data"]["items"] == []


def test_manual_content_versions_coverage_calendar_publication_and_legacy_receipt(teacher, tmp_path):
    _, manager, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    chapters = call("textbook.version", {"id": lesson["version_id"]})["data"]["chapters"]
    children = [chapter for chapter in chapters if chapter["parent_id"]]
    params = {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "title": "人工进度测试",
        "start_date": "2026-11-02", "end_date": "2026-11-30", "weekly_slots": [{"weekday": 0, "start_time": "08:20"}, {"weekday": 2, "start_time": "14:00"}],
        "excluded_dates": ["2026-11-11"], "chapters": [{"chapter_id": chapter["id"], "difficulty": index + 1} for index, chapter in enumerate(children)],
        "practice_sessions": 1, "review_sessions": 1, "exam_sessions": 1, "exam_minutes": 120}
    plan = saved(call, "plan.save", params, "legacy-plan-request")
    prefix = manager._plugins["teacher-assistant"].module.__name__ + ".teaching"
    schema = importlib.import_module(prefix + ".planning_models")
    database = importlib.import_module(prefix + ".database").database
    old_payload = schema.PlanSave.model_validate(params).model_dump(mode="json", exclude={"session_content"})
    old_fingerprint = hashlib.sha256(json.dumps(old_payload, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()
    with database() as conn:
        conn.execute("UPDATE command_receipts SET fingerprint=? WHERE request_id='legacy-plan-request'", (old_fingerprint,))
    assert saved(call, "plan.save", params, "legacy-plan-request")["id"] == plan["id"]
    publication = saved(call, "plan.publish", {"id": plan["id"], "review_note": "先发布原版"})
    first = publication["events"][0]
    saved(call, "calendar.progress", {"id": first["id"], "version": 1, "publication_id": publication["id"], "status": "completed", "actual_minutes": 70, "note": "保留已授课实际记录"})
    content = [{key: session[key] for key in ("kind", "chapter_id", "title")} for session in plan["sessions"]]
    content[0]["title"] = "机器人组成回顾与课堂提问"
    content[2] = {"kind": "teaching", "chapter_id": children[0]["id"], "title": "增加基础章节巩固"}
    content[1], content[5] = content[5], content[1]
    changed = {**params, "parent_id": plan["id"], "session_content": content}
    assert call("plan.save", {**changed, "session_content": content[:-1]}, "invalid-content-count")["error"]["code"] == "plan_content_count"
    wrong_kind = deepcopy(content)
    wrong_kind[0] = {"kind": "exam", "chapter_id": None, "title": "错误增加考核"}
    assert call("plan.save", {**changed, "session_content": wrong_kind}, "invalid-content-kind")["error"]["code"] == "plan_content_kinds"
    wrong_chapter = deepcopy(content)
    wrong_chapter[0]["chapter_id"] = "other-textbook-chapter"
    assert call("plan.save", {**changed, "session_content": wrong_chapter}, "invalid-content-chapter")["error"]["code"] == "plan_content_chapters"
    revised = tool("plan.save", changed, "manual-plan-once")
    assert revised["ok"], revised
    revised = revised["data"]
    assert revised["version"] == 2 and revised["totals"] == plan["totals"]
    assert [item["starts_at"] for item in revised["sessions"]] == [item["starts_at"] for item in plan["sessions"]]
    assert [item["kind"] for item in revised["sessions"]][1] == "practice"
    assert [sum(session["chapter_id"] == chapter["id"] for session in revised["sessions"]) for chapter in children] == [3, 2]
    assert [part["kind"] for part in revised["sessions"][1]["periods"]] == ["teaching", "break", "teaching"]
    assert saved(call, "plan.save", changed, "manual-plan-once")["id"] == revised["id"]
    published = saved(call, "plan.publish", {"id": revised["id"], "replaces_publication_id": publication["id"], "review_note": "人工调整未来课次并保留进度"})
    assert published["events"][0]["id"] == first["id"] and published["events"][0]["actual_minutes"] == 70
    assert published["events"][0]["title"] == content[0]["title"]
    assert call("calendar.publication", {"id": publication["id"]})["data"]["events"][0]["title"] == first["title"]
    assert call("plan.get", {"id": plan["id"]})["data"]["sessions"][1]["kind"] == "teaching"
    assert len(call("plan.list", {"course_id": lesson["course_id"]})["data"]["items"]) == 2
