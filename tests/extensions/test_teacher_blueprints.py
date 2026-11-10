"""Blueprints pin reviewed teaching versions and produce prompts without manual style images."""

from copy import deepcopy
import hashlib
import json
import sqlite3

from tests.extensions.test_teacher_foundation import saved, teacher
from tests.extensions.test_teacher_documents import lesson_fixture, plan_fixture, script_fixture

__all__ = ["teacher"]


def blueprint_fixture(source_id, point_id):
    return {"title": "模拟课件页面蓝图", "theme": "blue_white", "pages": [
        {"number": index + 1, "unit_index": index // 4, "purpose": "concept", "title": "测试技术参数页" + str(index + 1),
         "key_messages": ["自由度描述独立运动的数量"], "source_ids": [source_id], "knowledge_point_ids": [point_id],
         "script_references": [{"unit_index": index // 4, "segment_index": index % 4}], "duration_minutes": 10,
         "visuals": [{"kind": "diagram", "description": "机器人关节独立运动的概念示意", "source_ids": [source_id]}],
         "layout": "two_column", "teacher_notes": "结合本页示意图解释教材概念"}
        for index in range(8)]}


def preparation_fixture(call, tmp_path):
    lesson = lesson_fixture(call, tmp_path)
    source_id = lesson["sources"][0]["id"]
    script = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "script", "content": script_fixture(source_id)})
    saved(call, "document.review", {"id": script["id"], "decision": "approved"})
    plan = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "lesson_plan", "script_id": script["id"], "content": plan_fixture()})
    saved(call, "document.review", {"id": plan["id"], "decision": "approved"})
    points = call("knowledge.list", {"version_id": lesson["version_id"]})["data"]["items"]
    point_id = next(point["id"] for point in points if point["source_id"] == source_id)
    content = blueprint_fixture(source_id, point_id)
    params = {"lesson_id": lesson["id"], "kind": "slide_blueprint", "script_id": script["id"], "plan_id": plan["id"], "content": content}
    return lesson, script, plan, params


def test_blueprint_source_links_and_automatic_page_prompt(teacher, tmp_path):
    _, _, call = teacher
    lesson, script, plan, params = preparation_fixture(call, tmp_path)
    content = params["content"]
    blueprint = saved(call, "document.save", params)
    prompt = call("slide.prompt", {"id": blueprint["id"], "page_number": 1})
    assert prompt["ok"], prompt
    assert prompt["data"]["required_reference_image"] is False
    assert "自由度描述独立运动的数量" in prompt["data"]["prompt"]
    assert plan["content"]["objectives"] in prompt["data"]["prompt"]
    assert prompt["data"]["aspect_ratio"] == "16:9"
    saved(call, "document.review", {"id": blueprint["id"], "decision": "approved"})
    assert call("document.export", {"id": blueprint["id"]}, "no-blueprint-docx")["error"]["code"] == "unsupported_export"
    wrong = deepcopy(content)
    wrong["pages"][0]["knowledge_point_ids"] = ["invented-point"]
    assert call("document.save", {**params, "expected_version": 1, "content": wrong}, "wrong-point")["error"]["code"] == "association_conflict"
    missing = deepcopy(content)
    missing["pages"][0]["script_references"] = [{"unit_index": 0, "segment_index": 1}]
    assert call("document.save", {**params, "expected_version": 1, "content": missing}, "missing-segment")["error"]["code"] == "incomplete_blueprint"
    assert call("document.generation.begin", {"lesson_id": lesson["id"], "kind": "slide_blueprint", "allow_model_call": True}, "blueprint-generation")["data"]["input_documents"] == {"script_id": script["id"], "plan_id": plan["id"]}


def test_schema_three_document_command_replays_after_upgrade(teacher, tmp_path):
    home, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    params = {"lesson_id": lesson["id"], "kind": "script", "content": script_fixture(lesson["sources"][0]["id"])}
    original = saved(call, "document.save", params, "before-schema-four")
    old_payload = {**params, "expected_version": 0, "script_id": None, "generation_id": None}
    legacy_hash = hashlib.sha256(json.dumps(old_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
        conn.execute("UPDATE command_receipts SET fingerprint=? WHERE request_id='before-schema-four'", (legacy_hash,))
    replay = saved(call, "document.save", params, "before-schema-four")
    assert replay["id"] == original["id"]
    assert len(call("document.list", {"lesson_id": lesson["id"]})["data"]["items"]) == 1
