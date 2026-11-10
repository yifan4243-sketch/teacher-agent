"""Loopback-only model for the teacher Desktop integration tests."""

import json
from pathlib import Path
import re
import sqlite3
import sys

from tests.e2e.core.history._helpers import NO_BACKGROUND_REVIEW, OFFLINE_CONFIG
from tests.fakes.fake_llm_provider import FakeLLMServer, Text, ToolCall, write_hermes_home
from tests.extensions.test_teacher_documents import plan_fixture, script_fixture
from tests.extensions.test_teacher_blueprints import blueprint_fixture


def document_responder(home):
    stages = {}

    def respond(record):
        messages = record["body"]["messages"]
        match = next((re.search(r"生成任务ID为 ([0-9a-f-]+)，kind为 (script|lesson_plan|slide_blueprint)", str(message.get("content", "")))
                      for message in reversed(messages) if message["role"] == "user"), None)
        if match is None:
            return Text("本地界面测试模型。")
        identifier, kind = match.groups()
        path = home / "plugin-data/teacher-assistant/teaching.db"
        with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as conn:
            conn.row_factory = sqlite3.Row
            generation = dict(conn.execute("SELECT * FROM document_generations WHERE workflow_id=?", (identifier,)).fetchone())
            source = conn.execute("SELECT source_id FROM lesson_sources WHERE lesson_id=? ORDER BY ordinal LIMIT 1", (generation["lesson_id"],)).fetchone()[0]
            script = conn.execute("SELECT id FROM teaching_documents WHERE lesson_id=? AND kind='script' AND status='approved' ORDER BY version DESC LIMIT 1", (generation["lesson_id"],)).fetchone()
            plan = conn.execute("SELECT id FROM teaching_documents WHERE lesson_id=? AND kind='lesson_plan' AND status='approved' ORDER BY version DESC LIMIT 1", (generation["lesson_id"],)).fetchone()
            point = conn.execute("SELECT id,version_id FROM knowledge_points WHERE source_id=? LIMIT 1", (source,)).fetchone()
        stage = stages.get(identifier, 0)
        stages[identifier] = stage + 1
        calls = [("teacher_preparation", {"operation": "document.schema"}),
                 ("teacher_preparation", {"operation": "preparation.context", "data": {"id": generation["lesson_id"]}})]
        if kind in {"lesson_plan", "slide_blueprint"}:
            calls.append(("teacher_preparation", {"operation": "document.get", "data": {"id": script[0]}}))
        if kind == "slide_blueprint":
            calls.extend((("teacher_preparation", {"operation": "document.get", "data": {"id": plan[0]}}),
                          ("teacher_knowledge", {"operation": "knowledge.list", "data": {"version_id": point[1]}})))
        content = {"script": lambda: script_fixture(source), "lesson_plan": plan_fixture,
                   "slide_blueprint": lambda: blueprint_fixture(source, point[0])}[kind]()
        calls.append(("teacher_preparation", {"operation": "document.save", "data": {"lesson_id": generation["lesson_id"], "kind": kind,
                "expected_version": generation["expected_version"], "generation_id": identifier,
                "script_id": script[0] if kind in {"lesson_plan", "slide_blueprint"} and script else None,
                "plan_id": plan[0] if kind == "slide_blueprint" and plan else None,
                "content": content}, "request_id": identifier + ":model-save"}))
        if stage == 0:
            skill = "teacher-slide-design" if kind == "slide_blueprint" else "teacher-preparation"
            return ToolCall("tool_call", {"calls": [{"name": "skill_view", "arguments": {"name": "teacher-assistant:" + skill}}]})
        if stage <= len(calls):
            name, arguments = calls[stage - 1]
            return ToolCall("tool_call", {"calls": [{"name": name, "arguments": arguments}]})
        return Text("本地模拟模型已保存教学草稿，请教师审核。")

    return respond


def main():
    home = Path(sys.argv[1])
    with FakeLLMServer(document_responder(home), default_text="本地界面测试模型。") as server:
        write_hermes_home(home, server.base_url, extra_config=OFFLINE_CONFIG + NO_BACKGROUND_REVIEW + "plugins:\n  enabled: [teacher-assistant]\nonboarding:\n  run: false\n")
        print(json.dumps({"ready": True}), flush=True)
        sys.stdin.readline()
        print(json.dumps({"model_requests": len(server.main_requests())}), flush=True)


if __name__ == "__main__":
    main()
