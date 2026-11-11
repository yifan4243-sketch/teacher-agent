"""Publish actual plans, preserve teacher records and prevent calendar conflicts atomically."""

from datetime import date, timedelta

import pytest

from tests.extensions.test_teacher_documents import lesson_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_knowledge import make_book

__all__ = ["teacher"]


@pytest.fixture
def calendar_workspace(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    recent = date.today() - timedelta(days=35)
    monday = recent - timedelta(days=recent.weekday())
    params = {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "title": "课表测试计划",
        "start_date": monday.isoformat(), "end_date": (monday + timedelta(days=14)).isoformat(),
        "weekly_slots": [{"weekday": 0, "start_time": "08:20"}]}
    plan = saved(call, "plan.save", params)
    return call, lesson, params, plan


def test_publish_move_progress_replacement_and_frozen_history(calendar_workspace):
    call, lesson, params, plan = calendar_workspace
    assert tool("plan.publish", {"id": plan["id"], "review_note": "not authorized"}, "agent-publish")["ok"] is False
    published = saved(call, "plan.publish", {"id": plan["id"], "review_note": "教师复核实际日期"}, "publish-once")
    assert len(published["events"]) == 3 and published["progress"]["completed_sessions"] == 0
    assert saved(call, "plan.publish", {"id": plan["id"], "review_note": "教师复核实际日期"}, "publish-once")["id"] == published["id"]
    first = published["events"][0]
    moved_day = date.fromisoformat(first["starts_at"][:10]) + timedelta(days=1)
    moved = saved(call, "calendar.move", {"id": first["id"], "publication_id": published["id"], "version": 1,
        "starts_at": moved_day.isoformat() + "T10:00", "note": "测试调课"})
    assert moved["ends_at"].endswith("11:30:00")
    assert [(part["kind"], part["start"][11:16], part["end"][11:16]) for part in moved["periods"]] == [
        ("teaching", "10:00", "10:40"), ("break", "10:40", "10:50"), ("teaching", "10:50", "11:30")]
    complete = {"id": first["id"], "publication_id": published["id"], "version": moved["version"], "status": "completed",
        "actual_minutes": 70, "lesson_id": lesson["id"], "note": "教师记录实际完成70分钟"}
    finished = saved(call, "calendar.progress", complete, "progress-once")
    assert finished["version"] == 3 and saved(call, "calendar.progress", complete, "progress-once")["version"] == 3
    assert call("calendar.progress", complete, "stale-progress")["error"]["code"] == "version_conflict"
    changed = saved(call, "plan.save", {**params, "parent_id": plan["id"], "end_date": (date.fromisoformat(params["end_date"]) + timedelta(days=7)).isoformat()})
    assert call("plan.publish", {"id": changed["id"], "review_note": "missing replacement"}, "wrong-publication")["error"]["code"] == "publication_conflict"
    replacement = saved(call, "plan.publish", {"id": changed["id"], "replaces_publication_id": published["id"], "review_note": "确认保留旧进度并增加课次"})
    carried = replacement["events"][0]
    assert carried["id"] == first["id"] and carried["starts_at"] == moved["starts_at"] and carried["actual_minutes"] == 70
    assert replacement["progress"]["actual_instruction_minutes"] == 70
    assert replacement["progress"]["instruction_variance_minutes"] == -10
    assert replacement["progress"]["remaining_instruction_minutes"] == 240
    old = call("calendar.publication", {"id": published["id"]})["data"]
    assert not old["active"] and old["events"][0]["version"] == 3
    assert call("calendar.progress", {**complete, "version": 3}, "archived-view-action")["error"]["code"] == "publication_conflict"
    corrected = saved(call, "calendar.progress", {**complete, "publication_id": replacement["id"], "version": 3, "actual_minutes": 75, "note": "教师更正实际分钟"})
    assert corrected["actual_minutes"] == 75
    assert call("calendar.publication", {"id": published["id"]})["data"]["events"][0]["actual_minutes"] == 70
    assert call("plan.get", {"id": plan["id"]})["data"]["sessions"][0]["starts_at"] == first["starts_at"]
    assert len(call("calendar.history", {"id": first["id"]})["data"]["items"]) == 3
    listed = call("calendar.list", {"start_date": params["start_date"], "end_date": changed["config"]["end_date"]})["data"]
    assert len(listed["items"]) == 4 and listed["progress"]["actual_instruction_minutes"] == 75
    earlier = saved(call, "plan.save", {**params, "parent_id": changed["id"], "end_date": changed["config"]["end_date"],
        "start_date": (date.fromisoformat(params["start_date"]) - timedelta(days=7)).isoformat()})
    third = saved(call, "plan.publish", {"id": earlier["id"], "replaces_publication_id": replacement["id"], "review_note": "增加较早课次并保留当前编号与原始编号"})
    carried = next(event for event in third["events"] if event["id"] == first["id"])
    assert carried["ordinal"] == 2 and carried["source_ordinal"] == 1 and carried["actual_minutes"] == 75
    assert call("calendar.publication", {"id": replacement["id"]})["data"]["events"][0]["ordinal"] == 1


def test_conflicting_courses_moves_restores_and_unmatched_edits_roll_back(calendar_workspace, tmp_path):
    call, _, params, plan = calendar_workspace
    published = saved(call, "plan.publish", {"id": plan["id"], "review_note": "测试发布"})
    course = saved(call, "course.create", {"title": "冲突测试课程"})
    version = saved(call, "textbook.import", {"course_id": course["id"], "title": "冲突测试教材", "path": str(make_book(tmp_path, ".txt"))})
    other = saved(call, "plan.save", {**params, "course_id": course["id"], "textbook_version_id": version["id"]})
    assert call("plan.publish", {"id": other["id"], "review_note": "冲突发布"}, "conflicting-course")["error"]["code"] == "calendar_conflict"
    assert call("plan.get", {"id": other["id"]})["data"]["publication"] is None
    events = published["events"]
    assert call("calendar.move", {"id": events[0]["id"], "publication_id": published["id"], "version": 1,
        "starts_at": events[1]["starts_at"], "note": "冲突移动"}, "conflicting-move")["error"]["code"] == "calendar_conflict"
    cancelled = saved(call, "calendar.progress", {"id": events[0]["id"], "publication_id": published["id"], "version": 1, "status": "cancelled", "note": "停课测试"})
    moved = saved(call, "calendar.move", {"id": events[1]["id"], "publication_id": published["id"], "version": 1,
        "starts_at": events[0]["starts_at"], "note": "补课使用停课时段"})
    assert call("calendar.progress", {"id": cancelled["id"], "publication_id": published["id"], "version": cancelled["version"],
        "status": "scheduled", "note": "恢复会冲突"}, "conflicting-restore")["error"]["code"] == "calendar_conflict"
    assert call("calendar.progress", {"id": cancelled["id"], "publication_id": published["id"], "version": cancelled["version"],
        "status": "completed", "actual_minutes": 75, "note": "补记也会冲突"}, "conflicting-completion")["error"]["code"] == "calendar_conflict"
    altered = saved(call, "plan.save", {**params, "parent_id": plan["id"], "excluded_dates": [events[1]["starts_at"][:10]]})
    assert call("plan.publish", {"id": altered["id"], "replaces_publication_id": published["id"], "review_note": "不能丢失调课"}, "unmatched-edit")["error"]["code"] == "publication_has_changes"
    assert call("plan.get", {"id": plan["id"]})["data"]["publication"]["id"] == published["id"]
    assert call("calendar.get", {"id": moved["id"]})["data"]["version"] == moved["version"]


def test_progress_future_minutes_and_lesson_association_boundaries(calendar_workspace, tmp_path):
    call, _, _, plan = calendar_workspace
    published = saved(call, "plan.publish", {"id": plan["id"], "review_note": "测试发布"})
    event = published["events"][0]
    complete = {"id": event["id"], "publication_id": published["id"], "version": 1, "status": "completed", "actual_minutes": 81, "note": "错误分钟"}
    assert call("calendar.progress", complete, "too-many-minutes")["error"]["code"] == "invalid_minutes"
    other_lesson = lesson_fixture(call, tmp_path)
    assert call("calendar.progress", {**complete, "actual_minutes": 80, "lesson_id": other_lesson["id"]}, "wrong-lesson")["error"]["code"] == "association_conflict"
    moved = saved(call, "calendar.move", {"id": event["id"], "publication_id": published["id"], "version": 1,
        "starts_at": "2099-01-05T08:20", "note": "未来课次测试"})
    assert call("calendar.progress", {**complete, "version": moved["version"], "actual_minutes": 80}, "future-progress")["error"]["code"] == "future_progress"
