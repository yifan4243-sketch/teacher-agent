"""Teacher plugin behavior through real discovery, dispatch and local SQLite."""

from concurrent.futures import ThreadPoolExecutor
from importlib import import_module
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
from uuid import uuid4

import pytest

import hermes_yaml as yaml


@pytest.fixture
def teacher(tmp_path, monkeypatch):
    from hermes_cli import plugins

    home = tmp_path / "teacher-home"
    source = Path(__file__).resolve().parents[2] / "extensions" / "teacher-assistant"
    shutil.copytree(source, home / "plugins" / "teacher-assistant",
                    ignore=shutil.ignore_patterns("__pycache__", "phase0-evidence", "test-results"))
    (home / "config.yaml").write_text(yaml.safe_dump({"plugins": {"enabled": ["teacher-assistant"]}}), encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(home))
    manager = plugins.PluginManager()
    monkeypatch.setattr(plugins, "_plugin_manager", manager)
    manager.discover_and_load()
    loaded = next(row for row in manager.list_plugins() if row["name"] == "teacher-assistant")
    assert loaded["enabled"] and not loaded["error"], loaded
    rpc = manager._plugin_rpc_methods["plugin.teacher-assistant.call"]

    def call(operation, data=None, request_id=None):
        return rpc({"operation": operation, "data": data, "request_id": request_id}, session_id=None)

    yield home, manager, call
    manager.unload("teacher-assistant")


def saved(call, operation, data, request_id=None):
    result = call(operation, data, request_id or str(uuid4()))
    assert result["ok"], result
    return result["data"]


def tool(operation, data=None, request_id=None, name="teacher_records"):
    from model_tools import handle_function_call

    return json.loads(handle_function_call(name, {"operation": operation, "data": data or {}, "request_id": request_id},
                                           task_id="teacher-foundation", enabled_toolsets=["teacher"]))


def test_native_tool_course_crud_timing_and_skill_load(teacher):
    from tools.skills_tool import skill_view

    home, _, _ = teacher
    created = tool("course.create", {"title": "测试数学课程"}, "course-create")
    assert created["ok"], created
    course = created["data"]
    assert (course["instruction_minutes"], course["session_span_minutes"], course["break_minutes"]) == (80, 90, 10)
    assert tool("course.get", {"id": course["id"]})["data"]["title"] == "测试数学课程"
    updated = tool("course.update", {"id": course["id"], "version": 1, "title": "测试语文课程"}, "course-update")
    assert updated["data"]["version"] == 2
    assert tool("course.list")["data"]["items"][0]["title"] == "测试语文课程"
    skill = json.loads(skill_view("teacher-assistant:teacher-workspace"))
    assert skill["success"] and "teacher_records" in skill["content"]
    db = home / "plugin-data" / "teacher-assistant" / "teaching.db"
    with sqlite3.connect(db) as conn:
        assert conn.execute("SELECT title FROM courses").fetchone()[0] == "测试语文课程"
        assert conn.execute("SELECT COUNT(*) FROM audit_events").fetchone()[0] == 2


def test_idempotency_version_and_input_validation(teacher):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "测试课程"}, "same-request")
    assert saved(call, "course.create", {"title": "测试课程"}, "same-request") == course
    assert call("course.create", {"title": "另一个课程"}, "same-request")["error"]["code"] == "idempotency_conflict"
    saved(call, "course.update", {"id": course["id"], "version": 1, "subject": "测试学科"})
    assert call("course.update", {"id": course["id"], "version": 1, "title": "旧修改"}, "stale")["error"]["code"] == "version_conflict"
    assert call("course.create", {"title": "  "}, "empty")["error"]["code"] == "invalid_input"
    assert call("course.create", {"title": "测试", "period_count": 1}, "invalid-break")["error"]["code"] == "invalid_input"
    assert call("course.create", {"title": "测试"})["error"]["code"] == "invalid_request_id"
    assert call(["invalid"], {})["error"]["code"] == "invalid_input"
    assert call("course.list", ["invalid"])["error"]["code"] == "invalid_input"


def test_concurrent_repeat_and_optimistic_updates(teacher):
    _, _, call = teacher
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: call("course.create", {"title": "并发测试"}, "concurrent"), range(4)))
    assert all(result["ok"] for result in results), results
    assert len({result["data"]["id"] for result in results}) == 1
    course = results[0]["data"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        changes = list(pool.map(lambda index: call("course.update", {"id": course["id"], "version": 1, "title": f"修改{index}"}, f"change-{index}"), range(2)))
    assert sum(result["ok"] for result in changes) == 1
    assert next(result for result in changes if not result["ok"])["error"]["code"] == "version_conflict"


def test_identity_course_association_and_student_privacy(teacher):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "测试课程"})
    group = saved(call, "class.create", {"name": "虚构测试班"})
    student = saved(call, "student.create", {"name": "虚构学生甲", "student_number": "TEST-001", "class_id": group["id"]})
    enrollment = {"course_id": course["id"], "student_id": student["id"]}
    assert call("enrollment.create", enrollment, "before-class")["error"]["code"] == "association_conflict"
    saved(call, "course.assign_class", {"course_id": course["id"], "class_id": group["id"]})
    saved(call, "enrollment.create", enrollment)
    assert call("enrollment.list", {"course_id": course["id"]})["data"]["items"][0]["student_id"] == student["id"]
    assert tool("student.list")["error"]["code"] == "permission_denied"
    assert call("student.create", {"name": "虚构学生乙", "student_number": "TEST-001", "class_id": group["id"]}, "duplicate-number")["error"]["code"] == "conflict"
    other = saved(call, "class.create", {"name": "虚构新班"})
    assert call("student.update", {"id": student["id"], "version": 1, "class_id": other["id"]}, "bad-move")["error"]["code"] == "association_conflict"


def test_workflow_review_persistence_and_replay(teacher):
    _, manager, call = teacher
    task = saved(call, "task.create", {"course": {"title": "审核测试课程"}})
    run = tool("task.run", {"id": task["id"]}, "run-once", name="teacher_tasks")
    assert run["ok"], run
    assert run["data"]["status"] == "awaiting_review"
    assert saved(call, "task.run", {"id": task["id"]})["result"]["id"] == run["data"]["result"]["id"]
    manager.discover_and_load(force=True)
    resumed = call("task.get", {"id": task["id"]})["data"]
    assert resumed["status"] == "awaiting_review" and len(resumed["steps"]) == 1
    assert tool("task.review", {"id": task["id"], "version": resumed["version"], "decision": "approved"}, "agent-review", name="teacher_tasks")["error"]["code"] == "unknown_operation"
    approved = saved(call, "task.review", {"id": task["id"], "version": resumed["version"], "decision": "approved"})
    assert approved["status"] == "completed"
    assert approved["approval"]["reviewed_by"] == "desktop:teacher"
    assert len(call("course.list")["data"]["items"]) == 1


def test_permissions_cannot_be_widened_by_agent_or_workflow(teacher):
    _, _, call = teacher
    task = saved(call, "task.create", {"course": {"title": "权限测试"}})
    result = call("settings.update", {"disabled_operations": ["course.create"]})
    assert result["ok"], result
    assert tool("course.create", {"title": "禁止创建"}, "denied")["error"]["code"] == "permission_denied"
    assert tool("task.run", {"id": task["id"]}, "denied-task", name="teacher_tasks")["error"]["code"] == "permission_denied"
    assert tool("settings.update", {"disabled_operations": []})["error"]["code"] == "permission_denied"
    assert call("settings.update", {"agent_student_access": "false"})["error"]["code"] == "invalid_input"
    assert call("settings.update", {"stage_models": {"grading": {"provider": "local", "model": "test", "api_key": "forbidden"}}})["error"]["code"] == "invalid_input"


def test_cancel_and_stale_review_preserve_records(teacher):
    _, _, call = teacher
    task = saved(call, "task.create", {"course": {"title": "取消测试"}})
    cancelled = saved(call, "task.cancel", {"id": task["id"], "version": task["version"]})
    assert cancelled["status"] == "cancelled"
    assert call("task.run", {"id": task["id"]}, "cancelled-run")["error"]["code"] == "invalid_transition"
    task = saved(call, "task.create", {"course": {"title": "过期审核测试"}})
    run = saved(call, "task.run", {"id": task["id"]})
    course = run["result"]
    saved(call, "course.update", {"id": course["id"], "version": course["version"], "title": "已改变课程"})
    assert call("task.review", {"id": task["id"], "version": run["version"], "decision": "approved"}, "stale-review")["error"]["code"] == "version_conflict"


def test_profile_database_isolation(teacher, tmp_path):
    from hermes_constants import reset_hermes_home_override, set_hermes_home_override

    _, _, call = teacher
    saved(call, "course.create", {"title": "配置一课程"}, "profile-request")
    token = set_hermes_home_override(tmp_path / "other-profile")
    try:
        assert call("course.list")["data"]["items"] == []
        saved(call, "course.create", {"title": "配置二课程"}, "profile-request")
    finally:
        reset_hermes_home_override(token)
    assert call("course.list")["data"]["items"][0]["title"] == "配置一课程"


def test_failed_step_rolls_back_partial_course_and_can_retry(teacher, monkeypatch):
    _, manager, call = teacher
    service_module = sys.modules[manager._plugins["teacher-assistant"].module.TeachingService.__module__]
    workflow_module = import_module(".workflows", service_module.__package__)
    original_create = workflow_module.create_record

    def fail_after_insert(conn, entity, data, actor):
        original_create(conn, entity, data, actor)
        raise workflow_module.DomainError("step_failed", "测试注入的步骤失败")

    task = saved(call, "task.create", {"course": {"title": "失败恢复测试"}})
    with monkeypatch.context() as context:
        context.setattr(workflow_module, "create_record", fail_after_insert)
        failed = saved(call, "task.run", {"id": task["id"]})
    assert failed["status"] == "failed" and failed["steps"] == []
    assert call("course.list")["data"]["items"] == []
    pending = saved(call, "task.retry", {"id": task["id"], "version": failed["version"]})
    assert pending["status"] == "pending"
    resumed = saved(call, "task.run", {"id": task["id"]})
    assert resumed["status"] == "awaiting_review"
    assert len(call("course.list")["data"]["items"]) == 1


def test_new_process_resumes_task_without_recreating_course(teacher):
    _, _, call = teacher
    task = saved(call, "task.create", {"course": {"title": "跨进程恢复测试"}})
    run = saved(call, "task.run", {"id": task["id"]})
    program = """
import json,sys
from model_tools import handle_function_call
args=json.loads(sys.stdin.read())
reply=handle_function_call('teacher_tasks', {'operation':'task.run','data':args,'request_id':'after-process-restart'}, enabled_toolsets=['teacher'])
print('TEACHER_RECEIPT='+reply)
"""
    child = subprocess.run([sys.executable, "-c", program], cwd=Path(__file__).resolve().parents[2],
                           input=json.dumps({"id": task["id"]}), capture_output=True, text=True, encoding="utf-8", timeout=60, check=False)
    assert child.returncode == 0, child.stderr
    receipt = json.loads(next(line.removeprefix("TEACHER_RECEIPT=") for line in child.stdout.splitlines() if line.startswith("TEACHER_RECEIPT=")))
    assert receipt["ok"], receipt
    assert receipt["data"]["status"] == "awaiting_review"
    assert receipt["data"]["result"]["id"] == run["result"]["id"]
    assert len(call("course.list")["data"]["items"]) == 1


def test_actual_hermes_agent_loop_with_scripted_model(teacher):
    from run_agent import AIAgent
    from tests.e2e.core.history._helpers import NO_BACKGROUND_REVIEW, OFFLINE_CONFIG
    from tests.fakes.fake_llm_provider import FakeLLMServer, Text, ToolCall, write_hermes_home

    home, _, call = teacher
    seen = []

    def respond(record):
        request = record["body"]
        seen.append(request)
        last = next((message for message in reversed(request["messages"]) if message["role"] == "tool"), None)
        if len(seen) == 1:
            return ToolCall("tool_call", {"calls": [{"name": "teacher_records", "arguments": {"operation": "course.create", "data": {"title": "Agent真实入库测试"}, "request_id": "agent-create"}}]})
        payload = json.loads(last["content"])
        assert payload["ok"], payload
        course = payload["data"]
        if len(seen) == 2:
            return ToolCall("tool_call", {"calls": [{"name": "teacher_records", "arguments": {"operation": "course.get", "data": {"id": course["id"]}}}]})
        if len(seen) == 3:
            return ToolCall("tool_call", {"calls": [{"name": "teacher_records", "arguments": {"operation": "course.update", "data": {"id": course["id"], "version": course["version"], "subject": "测试学科"}, "request_id": "agent-update"}}]})
        return Text("课程已创建、查询并修改。")

    with FakeLLMServer(respond) as server:
        write_hermes_home(home, server.base_url, extra_config=OFFLINE_CONFIG + NO_BACKGROUND_REVIEW + "plugins:\n  enabled: [teacher-assistant]\n")
        agent = AIAgent(provider="custom", model="fake-model", base_url=server.base_url, api_key="sk-test-only",
                        enabled_toolsets=["teacher"], quiet_mode=True, skip_memory=True, skip_context_files=True,
                        max_iterations=6, session_id="teacher-agent-test")
        agent._auto_recovery_cycles = 0
        try:
            result = agent.run_conversation("创建测试课程，查询后把学科改为测试学科。", conversation_history=[], task_id="teacher-agent-test")
        finally:
            agent.close()
    assert result.get("completed"), result
    course = call("course.list")["data"]["items"][0]
    assert course["subject"] == "测试学科" and course["version"] == 2
    assert len(seen) == 4
    assert seen[0]["messages"][0]["role"] == "system"
    assert all(request["messages"][0] == seen[0]["messages"][0] for request in seen)
