"""Loopback-only model for the teacher Desktop integration tests."""

import json
from pathlib import Path
import re
import shutil
import sqlite3
import sys

from tests.e2e.core.history._helpers import NO_BACKGROUND_REVIEW, OFFLINE_CONFIG
from tests.fakes.fake_llm_provider import FakeLLMServer, Text, ToolCall, write_hermes_home
from tests.extensions.test_teacher_documents import plan_fixture, script_fixture
from tests.extensions.test_teacher_blueprints import blueprint_fixture
from tests.extensions.test_teacher_slides import sample_layout
from tests.extensions.test_teacher_questions import question_params
from tests.extensions.test_teacher_grading import assessment_fixture


def exam_responder(home):
    stages = {}

    def respond(identifier):
        with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
            conn.row_factory = sqlite3.Row
            generation = dict(conn.execute("SELECT * FROM exam_generations WHERE workflow_id=?", (identifier,)).fetchone())
            plan = dict(conn.execute("SELECT * FROM exam_plans WHERE id=?", (generation["plan_id"],)).fetchone())
            scope = json.loads(plan["scope_json"])
            config = json.loads(plan["config_json"])
            saved_questions = [row[0] for row in conn.execute("SELECT id FROM question_versions WHERE prompt LIKE ? ORDER BY rowid", ("%UI原生命题 " + identifier + "%",))]
        source = scope["source_ids"][0]
        calls = [("teacher_assessment", {"operation": "exam.plan.get", "data": {"id": plan["id"]}}),
                 ("teacher_knowledge", {"operation": "source.get", "data": {"id": source}}),
                 ("teacher_assessment", {"operation": "question.schema"})]
        lesson = {"course_id": plan["course_id"], "version_id": plan["textbook_version_id"], "sources": [{"id": source}]}
        for item in config["question_types"]:
            for index in range(item["count"]):
                params = question_params(lesson, item["kind"])
                params["content"]["prompt"] += f" UI原生命题 {identifier} {item['kind']} {index}"
                params["content"]["explanation"] = "模拟解析仅教师可见，依据测试教材说明。"
                calls.append(("teacher_assessment", {"operation": "question.save", "data": params, "request_id": f"{identifier}:{item['kind']}:{index}"}))
        calls.append(("teacher_assessment", {"operation": "exam.paper.save", "data": {"plan_id": plan["id"], "title": plan["title"],
            "question_ids": saved_questions, "generation_id": identifier}, "request_id": identifier + ":paper"}))
        stage = stages.get(identifier, 0)
        stages[identifier] = stage + 1
        if stage == 0:
            return ToolCall("skill_view", {"name": "teacher-assistant:teacher-assessment"})
        if stage <= len(calls):
            name, arguments = calls[stage - 1]
            return ToolCall("tool_call", {"calls": [{"name": name, "arguments": arguments}]})
        return Text("本地模拟模型已保存试卷草稿，请教师审核。")

    return respond


def document_responder(home):
    stages = {}
    exam = exam_responder(home)
    grading = grading_responder(home)

    def respond(record):
        messages = record["body"]["messages"]
        if any("将本页答卷中的印刷、扫描或手写作答逐字转录" in str(message.get("content", "")) for message in messages):
            return answer_transcription(messages)
        grading_match = next((re.search(r"批改任务ID ([0-9a-f-]+)", str(message.get("content", "")))
                              for message in reversed(messages) if message["role"] == "user"), None)
        if grading_match:
            return grading(grading_match.group(1))
        exam_match = next((re.search(r"生成任务ID ([0-9a-f-]+)", str(message.get("content", "")))
                           for message in reversed(messages) if message["role"] == "user"), None)
        if exam_match:
            return exam(exam_match.group(1))
        if any("将这张教学幻灯片图片分解为可编辑页面对象" in str(message.get("content", "")) for message in messages):
            layout = sample_layout()
            layout["elements"].append({"kind": "image", "name": "detail-illustration", "x": 1460, "y": 400, "width": 100, "height": 100,
                "source_x": 1110, "source_y": 400, "source_width": 100, "source_height": 100, "description": "独立裁切插画技术样例"})
            return Text(json.dumps(layout, ensure_ascii=False))
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
            return ToolCall("skill_view", {"name": "teacher-assistant:" + skill})
        if stage == 1:
            loaded = json.loads(messages[-1]["content"])
            assert loaded.get("success") is True, loaded
        if stage <= len(calls):
            name, arguments = calls[stage - 1]
            return ToolCall("tool_call", {"calls": [{"name": name, "arguments": arguments}]})
        return Text("本地模拟模型已保存教学草稿，请教师审核。")

    return respond


def answer_transcription(messages):
    for message in messages:
        for block in message.get("content", []) if isinstance(message.get("content"), list) else []:
            if block.get("type") != "text" or not block.get("text", "").startswith('{"page_number"'):
                continue
            payload = json.loads(block["text"])
            responses = {"single_choice": {"selected_ids": ["A"]}, "multiple_choice": {"selected_ids": ["A", "B"]},
                "true_false": {"answer": True}, "fill_blank": {"values": ["自由度", "工作空间"]},
                "short_answer": {"text": "Independent motion count"}}
            answers = [{"question_id": question["question_id"], "content": {"kind": question["kind"], **responses[question["kind"]]},
                "observed_text": "Independent motion count" if question["kind"] == "short_answer" else "scripted transcription",
                "confidence": 0.4 if question["kind"] == "short_answer" else 0.95, "note": "本机模拟识别响应"}
                for question in payload["questions"]]
            return Text(json.dumps({"answers": answers, "unassigned_text": "", "note": "模拟视觉输出，用于集成测试"}, ensure_ascii=False))
    raise AssertionError("Missing question context in recognition request")


def seed_recognition(home):
    from hermes_cli.plugins import PluginManager
    from tests.extensions.test_teacher_recognition import scanned_pdf

    manager = PluginManager()
    manager.discover_and_load()
    rpc = manager._plugin_rpc_methods["plugin.teacher-assistant.call"]
    def call(operation, data=None, request_id=None):
        return rpc({"operation": operation, "data": data, "request_id": request_id}, session_id=None)
    assessment_fixture(call, home)
    (home / "synthetic-scanned-answer.pdf").write_bytes(scanned_pdf())
    manager.unload("teacher-assistant")


def grading_responder(home):
    stages = {}

    def respond(identifier):
        with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
            conn.row_factory = sqlite3.Row
            questions = conn.execute("""SELECT q.id,q.content_json FROM grading_generations g
                JOIN grade_drafts d ON d.id=g.base_draft_id JOIN answer_submissions a ON a.id=d.submission_id
                JOIN exam_questions eq ON eq.paper_id=a.paper_id JOIN question_versions q ON q.id=eq.question_id
                WHERE g.workflow_id=? AND q.kind='short_answer' ORDER BY eq.ordinal""", (identifier,)).fetchall()
        scores = []
        for row in questions:
            content = json.loads(row["content_json"])
            awards = [item["points_centi"] for item in content["rubric"]]
            awards[-1] = max(0, awards[-1] - 100)
            scores.append({"question_id": row["id"], "points_centi": sum(awards), "rubric_awards": awards,
                "comment": "模拟评分建议，第二要点解释不足，请教师核对。", "confidence": 0.4})
        calls = [("teacher_assessment", {"operation": "grading.assist.schema"}),
                 ("teacher_assessment", {"operation": "grading.context", "data": {"id": identifier}}),
                 ("teacher_assessment", {"operation": "grading.assist.save", "data": {"id": identifier, "scores": scores}, "request_id": identifier + ":assist"})]
        stage = stages.get(identifier, 0)
        stages[identifier] = stage + 1
        if stage == 0:
            return ToolCall("skill_view", {"name": "teacher-assistant:teacher-grading"})
        if stage <= len(calls):
            name, arguments = calls[stage - 1]
            return ToolCall("tool_call", {"calls": [{"name": name, "arguments": arguments}]})
        return Text("本地模拟模型已保存主观题评分建议，请教师逐题复核。")

    return respond


def main():
    home = Path(sys.argv[1])
    image_plugin = home / "plugins/teacher-ui-image"
    image_plugin.mkdir(parents=True)
    shutil.copy2(Path(__file__).with_name("teacher_ui_image_provider.py"), image_plugin / "__init__.py")
    shutil.copy2(home / "plugins/teacher-assistant/resources/slide-prototype/generated-design.jpg", image_plugin / "fixture.jpg")
    (image_plugin / "plugin.yaml").write_text("name: teacher-ui-image\nversion: 0.0.1\ndescription: Offline test image fixture\n", encoding="utf-8")
    responder = document_responder(home)
    with FakeLLMServer(responder, aux=responder, default_text="本地界面测试模型。") as server:
        write_hermes_home(home, server.base_url, extra_config=OFFLINE_CONFIG + NO_BACKGROUND_REVIEW + "plugins:\n  enabled: [teacher-assistant, teacher-ui-image]\nimage_gen:\n  provider: teacher-ui-image\nonboarding:\n  run: false\n")
        if "--recognition-fixture" in sys.argv:
            seed_recognition(home)
        print(json.dumps({"ready": True}), flush=True)
        sys.stdin.readline()
        print(json.dumps({"model_requests": len(server.main_requests())}), flush=True)


if __name__ == "__main__":
    main()
