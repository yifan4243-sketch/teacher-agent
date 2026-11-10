"""Actual DOCX bytes, original-template preservation, source and review boundaries."""

import base64
from copy import deepcopy
import hashlib
from io import BytesIO
from pathlib import Path

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_knowledge import make_book

__all__ = ["teacher"]


def lesson_fixture(call, tmp_path):
    course = saved(call, "course.create", {"title": "DOCX文档测试课程"})
    version = saved(call, "textbook.import", {"course_id": course["id"], "title": "文档测试教材", "path": str(make_book(tmp_path, ".txt"))})
    source = call("knowledge.search", {"course_id": course["id"], "query": "自由度"})["data"]["items"][0]
    return saved(call, "lesson.create", {"course_id": course["id"], "version_id": version["id"], "title": "技术参数测试课次", "source_ids": [source["id"]]})


def script_fixture(source_id):
    # Repeated prose is deliberately a timing/render fixture, never a real teaching deliverable.
    prose = ("模拟测试正文用于验证中文长段落、时间估算和分页。" * 100)[:1540]
    purposes = ["introduction", "explanation", "example", "question", "practice", "explanation", "summary", "homework"]
    segments = [{"title": "测试环节" + str(index + 1), "purpose": purpose, "minutes": 10, "spoken_text": prose,
                 "activity_minutes": 3, "teacher_actions": ["观察测试学生活动"], "student_activity": "进行3分钟测试讨论",
                 "blackboard": "测试板书", "source_ids": [source_id]} for index, purpose in enumerate(purposes)]
    return {"title": "模拟逐字稿的技术验证样例", "units": [{"title": "上半课", "segments": segments[:4]}, {"title": "下半课", "segments": segments[4:]}],
            "homework": ["测试作业内容"]}


def plan_fixture():
    return {"title": "模拟教案的技术验证样例", "objectives": "理解自由度的测试教学目标", "key_points": "自由度概念", "difficulties": "概念与关节的联系",
            "preparation": "课前检查课件和教材", "summary": "回顾自由度与工作空间", "homework": "复习测试教材", "blackboard": "自由度与工作空间",
            "activities": [{"unit_index": unit, "segment_index": segment, "teacher_activity": "依据测试教材讲解概念并组织学生观察、提问和练习。",
                            "student_activity": "观察并完成练习", "methods": "讲授与讨论"} for unit in range(2) for segment in range(4)]}


def test_reviewed_docx_exports_and_template_geometry(teacher, tmp_path):
    from docx import Document
    from docx.enum.table import WD_ROW_HEIGHT_RULE
    from docx.oxml.ns import qn

    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    content = script_fixture(lesson["sources"][0]["id"])
    script = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "script", "content": content})
    assert script["timing"]["warnings"] == []
    assert script["timing"]["estimated_units_minutes"] == [40, 40]
    assert call("document.export", {"id": script["id"]}, "unreviewed-export")["error"]["code"] == "review_required"
    assert tool("document.review", {"id": script["id"], "decision": "approved"}, "agent-approve", name="teacher_preparation")["ok"] is False
    saved(call, "document.review", {"id": script["id"], "decision": "approved"})
    export = saved(call, "document.export", {"id": script["id"]})
    download = call("document.file", {"id": export["id"]})["data"]
    bytes_ = base64.b64decode(download["content_base64"])
    assert hashlib.sha256(bytes_).hexdigest() == export["sha256"]
    docx = Document(BytesIO(bytes_))
    assert docx.styles["Title"].element.pPr.find(qn("w:pBdr")).find(qn("w:bottom")).get(qn("w:val")) == "nil"
    assert any(paragraph.text == "课间休息10分钟" for paragraph in docx.paragraphs)
    assert content["units"][1]["segments"][3]["spoken_text"] in [paragraph.text for paragraph in docx.paragraphs]
    assert call("document.export", {"id": script["id"], "format": "pdf"}, "no-pdf")["error"]["code"] == "invalid_input"
    plan = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "lesson_plan", "script_id": script["id"], "content": plan_fixture()})
    saved(call, "document.review", {"id": plan["id"], "decision": "approved"})
    plan_export = saved(call, "document.export", {"id": plan["id"]})
    original_path = Path(__file__).resolve().parents[2] / "extensions/teacher-assistant/resources/templates/教案模板（新）.docx"
    original = Document(original_path)
    actual = Document(plan_export["stored_path"])
    assert plan_export["template_sha256"] == hashlib.sha256(original_path.read_bytes()).hexdigest()
    assert len(actual.tables) == 1 and len(actual.tables[0].rows) == len(original.tables[0].rows)
    assert [row.cells[0].text for row in actual.tables[0].rows] == [row.cells[0].text for row in original.tables[0].rows]
    assert actual.sections[0].page_width == original.sections[0].page_width
    assert [column.width for column in actual.tables[0].columns] == [column.width for column in original.tables[0].columns]
    assert actual.tables[0].rows[8].height_rule == WD_ROW_HEIGHT_RULE.AT_LEAST
    assert "课后由教师" in actual.tables[0].cell(13, 1).text
    assert "课间休息10分钟" in actual.tables[0].cell(8, 1).text


def test_script_revision_keeps_approved_version_and_rejects_stale_source_or_timing(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    content = script_fixture(lesson["sources"][0]["id"])
    script = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "script", "content": content})
    saved(call, "document.review", {"id": script["id"], "decision": "approved"})
    segment = deepcopy(content["units"][0]["segments"][0])
    segment["spoken_text"] = "修订后的开场讲解。" + segment["spoken_text"]
    revision = saved(call, "document.revise_segment", {"id": script["id"], "unit_index": 0, "segment_index": 0, "segment": segment})
    assert revision["version"] == 2 and revision["status"] == "draft"
    original = call("document.get", {"id": script["id"]})["data"]
    assert original["content"] == script["content"] and original["status"] == "approved"
    assert call("document.revise_segment", {"id": script["id"], "unit_index": 0, "segment_index": 0, "segment": segment}, "stale-revision")["error"]["code"] == "version_conflict"
    short = deepcopy(content)
    short["units"][0]["segments"][0]["spoken_text"] = "模拟不足时间的正文。" * 30
    draft = saved(call, "document.save", {"lesson_id": lesson["id"], "kind": "script", "expected_version": 2, "content": short})
    assert draft["timing"]["warnings"]
    assert call("document.review", {"id": draft["id"], "decision": "approved"}, "short-review")["error"]["code"] == "timing_review_failed"
    wrong = deepcopy(content)
    wrong["units"][0]["segments"][0]["source_ids"] = ["invented-source"]
    assert call("document.save", {"lesson_id": lesson["id"], "kind": "script", "expected_version": 3, "content": wrong}, "wrong-source")["error"]["code"] == "association_conflict"


def test_native_generation_claim_save_review_and_cancel_guard(teacher, tmp_path):
    import json
    from tools.skills_tool import skill_view

    _, _, call = teacher
    loaded = json.loads(skill_view("teacher-assistant:teacher-preparation"))
    assert loaded["success"] and "preparation.context" in loaded["content"]
    lesson = lesson_fixture(call, tmp_path)
    assert call("document.generation.begin", {"lesson_id": lesson["id"], "kind": "script"}, "no-consent")["error"]["code"] == "model_call_not_authorized"
    params = {"lesson_id": lesson["id"], "kind": "script", "allow_model_call": True}
    generation = saved(call, "document.generation.begin", params)
    identifier = generation["workflow_id"]
    claim = {"id": identifier, "runtime_session_id": "test-native-runtime", "stored_session_id": "test-native-stored"}
    running = saved(call, "document.generation.claim", claim)
    assert running["task"]["status"] == "running"
    assert call("document.generation.claim", claim, "repeat-start")["error"]["code"] == "invalid_transition"
    script = saved(call, "document.save", {"lesson_id": lesson["id"], "generation_id": identifier, "kind": "script", "content": script_fixture(lesson["sources"][0]["id"])})
    assert call("task.get", {"id": identifier})["data"]["status"] == "awaiting_review"
    revised = deepcopy(script["content"]["units"][0]["segments"][0])
    revised["title"] = "教师修订的导入环节"
    script = saved(call, "document.revise_segment", {"id": script["id"], "unit_index": 0, "segment_index": 0, "segment": revised})
    assert call("task.get", {"id": identifier})["data"]["result"]["document_id"] == script["id"]
    saved(call, "document.review", {"id": script["id"], "decision": "approved"})
    assert call("task.get", {"id": identifier})["data"]["status"] == "completed"
    cancelled = saved(call, "document.generation.begin", params)
    running = saved(call, "document.generation.claim", {**claim, "id": cancelled["workflow_id"]})
    saved(call, "task.cancel", {"id": cancelled["workflow_id"], "version": running["task"]["version"]})
    assert call("document.save", {"lesson_id": lesson["id"], "generation_id": cancelled["workflow_id"], "expected_version": 2,
                                  "kind": "script", "content": script_fixture(lesson["sources"][0]["id"])}, "late-save")["error"]["code"] == "invalid_transition"
