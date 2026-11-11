"""Real reminder persistence, source changes and at-most-once local dispatch boundaries."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import importlib
import runpy
from threading import Event

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_timetable import calendar_workspace

__all__ = ["calendar_workspace", "teacher"]


@pytest.fixture
def reminder_workspace(teacher, monkeypatch):
    _, manager, call = teacher
    prefix = manager._plugins["teacher-assistant"].module.__name__ + ".teaching"
    module = importlib.import_module(prefix + ".reminders")
    adapter = importlib.import_module(prefix + ".windows_notifications")
    errors = importlib.import_module(prefix + ".models")
    now = datetime(2026, 11, 11, 10, 0)
    monkeypatch.setattr(module, "local_now", lambda: now)
    return call, module, adapter, errors, now


def enabled(call, **updates):
    current = call("reminder.settings")["data"]
    return saved(call, "reminder.set_settings", {"version": current["version"], "enabled": True, **updates})


def task_params(now):
    return {"title": "虚构测试批改截止", "details": "本机提醒行为测试", "kind": "homework", "due_at": (now + timedelta(minutes=15)).isoformat(), "lead_minutes": 15}


def test_todo_native_tool_replay_disabled_mode_and_persisted_single_dispatch(reminder_workspace, monkeypatch):
    call, module, adapter, _, now = reminder_workspace
    params = task_params(now)
    created = tool("todo.create", params, "todo-once")
    assert created["ok"], created
    todo = created["data"]
    assert tool("todo.create", params, "todo-once")["data"]["id"] == todo["id"]
    calls = []
    monkeypatch.setattr(adapter, "notify", lambda *args: calls.append(args) or {"ok": True, "provider": "offline boundary"})
    assert module.tick(now=now)["enabled"] is False and not calls
    enabled(call)
    assert module.tick(now=now)["accepted"] == 1 and len(calls) == 1
    assert module.tick(now=now)["accepted"] == 0 and len(calls) == 1
    result = call("reminder.list")["data"]["items"][0]
    assert result["todo_id"] == todo["id"] and result["state"] == "accepted"
    assert result["receipt"]["provider"] == "offline boundary"
    assert tool("reminder.set_settings", {"version": 2, "enabled": False}, "agent-os-settings")["ok"] is False


def test_rescheduled_and_completed_todos_cancel_outdated_queue(reminder_workspace, monkeypatch):
    call, module, adapter, _, now = reminder_workspace
    params = task_params(now)
    todo = saved(call, "todo.create", params)
    enabled(call)
    saved(call, "reminder.refresh", {})
    first = call("reminder.list")["data"]["items"][0]
    params["due_at"] = (now + timedelta(minutes=45)).isoformat()
    updated = saved(call, "todo.update", {**params, "id": todo["id"], "version": 1})
    saved(call, "reminder.refresh", {})
    assert call("reminder.get", {"id": first["id"]})["data"]["state"] == "cancelled"
    assert call("todo.update", {**params, "id": todo["id"], "version": 1}, "stale-todo")["error"]["code"] == "version_conflict"
    saved(call, "todo.update", {**params, "id": todo["id"], "version": updated["version"], "status": "completed"})
    calls = []
    monkeypatch.setattr(adapter, "notify", lambda *args: calls.append(args))
    assert module.tick(now=now + timedelta(hours=1))["accepted"] == 0 and not calls
    assert all(item["state"] == "cancelled" for item in call("reminder.list")["data"]["items"])


def test_claim_survives_concurrency_failure_retry_and_late_window(reminder_workspace, monkeypatch):
    call, module, adapter, errors, now = reminder_workspace
    saved(call, "todo.create", task_params(now))
    enabled(call)
    started, release = Event(), Event()
    calls = []

    def notify(*args):
        calls.append(args)
        started.set()
        assert release.wait(30)
        raise errors.DomainError("notification_failed", "fixture OS rejection")

    monkeypatch.setattr(adapter, "notify", notify)
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(module.tick, now=now)
        try:
            assert started.wait(30)
            assert module.tick(now=now)["accepted"] == 0
        finally:
            release.set()
        assert first.result(timeout=30)["failed"] == 1
    assert len(calls) == 1
    original = call("reminder.list")["data"]["items"][0]
    assert original["state"] == "failed"
    assert module.tick(now=now)["accepted"] == 0 and len(calls) == 1
    retried = saved(call, "reminder.retry", {"id": original["id"]}, "retry-once")
    assert retried["parent_id"] == original["id"]
    assert saved(call, "reminder.retry", {"id": original["id"]}, "retry-once")["id"] == retried["id"]
    monkeypatch.setattr(adapter, "notify", lambda *args: {"ok": True, "provider": "offline boundary"})
    assert module.tick(now=now)["accepted"] == 1
    old = {**task_params(now), "title": "已过期测试", "due_at": (now - timedelta(hours=4)).isoformat(), "lead_minutes": 0}
    saved(call, "todo.create", old)
    module.tick(now=now)
    assert any(item["state"] == "expired" for item in call("reminder.list")["data"]["items"])


def test_calendar_move_and_cancel_update_actual_reminder_dates(calendar_workspace, teacher, monkeypatch):
    call, _, _, plan = calendar_workspace
    manager = teacher[1]
    module = importlib.import_module(manager._plugins["teacher-assistant"].module.__name__ + ".teaching.reminders")
    publication = saved(call, "plan.publish", {"id": plan["id"], "review_note": "提醒日期测试"})
    event = publication["events"][0]
    now = datetime.fromisoformat(event["starts_at"]) - timedelta(minutes=15)
    monkeypatch.setattr(module, "local_now", lambda: now)
    enabled(call, preparation_minutes=None, exam_minutes=None)
    saved(call, "reminder.refresh", {})
    first = next(item for item in call("reminder.list")["data"]["items"] if item["event_id"] == event["id"])
    new_start = datetime.fromisoformat(event["starts_at"]) + timedelta(days=1)
    moved = saved(call, "calendar.move", {"id": event["id"], "publication_id": publication["id"], "version": 1,
        "starts_at": new_start.isoformat(), "note": "调课同步提醒"})
    saved(call, "reminder.refresh", {})
    assert call("reminder.get", {"id": first["id"]})["data"]["state"] == "cancelled"
    new = next(item for item in call("reminder.list")["data"]["items"] if item["event_id"] == event["id"] and item["state"] == "queued")
    assert new["due_at"] == (new_start - timedelta(minutes=15)).isoformat()
    saved(call, "calendar.progress", {"id": event["id"], "publication_id": publication["id"], "version": moved["version"], "status": "cancelled", "note": "测试停课"})
    saved(call, "reminder.refresh", {})
    assert call("reminder.get", {"id": new["id"]})["data"]["state"] == "cancelled"


def test_native_cron_configuration_recovery_parallel_setup_and_plugin_disable(teacher, monkeypatch):
    home, manager, call = teacher
    prefix = manager._plugins["teacher-assistant"].module.__name__ + ".teaching"
    schedule = importlib.import_module(prefix + ".reminder_schedule")
    database = importlib.import_module(prefix + ".database").database
    errors = importlib.import_module(prefix + ".models")
    assert not tool("reminder.background.install", {}, "agent-scheduler")["ok"]

    def rejected(action, **kwargs):
        raise errors.DomainError("background_task_failed", "offline OS rejection")

    monkeypatch.setattr(schedule, "windows_task", rejected)
    result = call("reminder.background.install", {}, "os-reject")
    assert result["error"]["code"] == "background_task_failed"
    created = schedule.cron_call(action="list")["jobs"]
    assert len(created) == 1 and created[0]["no_agent"]

    calls = []

    def windows_task(action, **kwargs):
        calls.append(action)
        return {"ok": True, "installed": action != "remove", "enabled": True, "provider": "offline OS boundary"}

    monkeypatch.setattr(schedule, "windows_task", windows_task)
    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda request: call("reminder.background.install", {}, request), ["install-a", "install-b"]))
    assert all(result["ok"] for result in outcomes), outcomes
    assert {result["data"]["cron_job_id"] for result in outcomes} == {created[0]["job_id"]}
    assert len(schedule.cron_call(action="list")["jobs"]) == 1
    script = home / "scripts" / created[0]["script"]
    runpy.run_path(str(script), run_name="__main__")
    assert call("reminder.settings")["data"]["last_tick_at"]
    saved(call, "reminder.background.remove", {})
    assert not call("reminder.background.status")["data"]["cron"]["enabled"]
    saved(call, "reminder.background.install", {})
    assert call("reminder.background.status")["data"]["cron"]["enabled"]
    assert len(schedule.cron_call(action="list")["jobs"]) == 1
    replacement = home / "scripts" / "teacher-reminder-stale.py"
    replacement.write_text("print('old plugin runtime')\n", encoding="utf-8")
    schedule.cron_call(action="update", job_id=created[0]["job_id"], script=replacement.name)
    saved(call, "reminder.background.install", {})
    repaired = schedule.cron_call(action="list")["jobs"]
    assert len(repaired) == 1 and repaired[0]["script"] == script.name
    (home / "config.yaml").write_text("plugins:\n  enabled: []\n  disabled: [teacher-assistant]\n", encoding="utf-8")
    with database() as conn:
        conn.execute("UPDATE reminder_settings SET last_tick_at='before-disabled' WHERE id=1")
    runpy.run_path(str(script), run_name="__main__")
    assert call("reminder.settings")["data"]["last_tick_at"] == "before-disabled"
