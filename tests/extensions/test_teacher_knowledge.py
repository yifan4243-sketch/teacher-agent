"""Real Office/PDF parsing, immutable textbook versions, uploads and source retrieval."""

import base64
import hashlib
from pathlib import Path
import sqlite3
from uuid import uuid4

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher

__all__ = ["teacher"]


TEXT = "第一章 基本知识\n1.1 工业机器人组成\n工业机器人包含驱动系统、机械结构和控制系统。\n1.2 技术参数\n自由度描述机器人独立运动的数量。工作空间表示末端能够到达的范围。\n关节允许相邻构件相对运动。\n"


def make_book(path, suffix):
    target = path / ("测试教材" + suffix)
    {".txt": write_txt, ".docx": write_docx, ".pptx": write_pptx, ".pdf": write_pdf}[suffix](target)
    return target


def write_txt(target):
    target.write_text(TEXT, encoding="utf-8")


def write_docx(target):
    from docx import Document

    document = Document()
    document.add_heading("第一章 基本知识", 1)
    document.add_heading("1.1 工业机器人组成", 2)
    document.add_paragraph("工业机器人包含驱动系统、机械结构和控制系统。")
    document.add_heading("1.2 技术参数", 2)
    document.add_paragraph("自由度描述机器人独立运动的数量。")
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "工作空间"
    table.cell(0, 1).text = "末端能够到达的范围。"
    document.save(target)


def write_pptx(target):
    from pptx import Presentation

    presentation = Presentation()
    slide = presentation.slides.add_slide(presentation.slide_layouts[1])
    slide.shapes.title.text = "工业机器人的技术参数"
    slide.placeholders[1].text = "自由度描述独立运动的数量。\n工作空间表示末端能够到达的范围。"
    presentation.save(target)


def write_pdf(target):
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.pdfgen import canvas

    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    pdf = canvas.Canvas(str(target))
    pdf.setFont("STSong-Light", 14)
    pdf.drawString(60, 760, "第一章 工业机器人")
    pdf.drawString(60, 720, "自由度描述独立运动的数量。")
    pdf.showPage()
    pdf.save()


@pytest.mark.parametrize("suffix", [".txt", ".docx", ".pptx", ".pdf"])
def test_actual_formats_search_and_verified_source_locators(teacher, tmp_path, suffix):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "教材解析测试"})
    path = make_book(tmp_path, suffix)
    version = saved(call, "textbook.import", {"course_id": course["id"], "title": "测试教材", "path": str(path)})
    assert version["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert version["version"] == 1 and version["chapters"]
    assert version["knowledge_point_count"] > 0
    results = call("knowledge.search", {"course_id": course["id"], "query": "自由度"})
    assert results["ok"], results
    source = results["data"]["items"][0]
    assert "自由度" in source["text"] and source["filename"] == path.name
    reread = call("source.get", {"id": source["id"]})["data"]
    assert reread == source
    if suffix in {".pdf", ".pptx"}:
        assert source["page"] == 1
    else:
        assert source["page"] is None
    assert Path(version["stored_path"]).read_bytes() == path.read_bytes()


def test_versions_default_latest_and_chapter_descendants(teacher, tmp_path):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "版本测试"})
    path = make_book(tmp_path, ".txt")
    params = {"course_id": course["id"], "title": "测试教材", "path": str(path)}
    first = saved(call, "textbook.import", params)
    assert saved(call, "textbook.import", params)["id"] == first["id"]
    path.write_text(TEXT.replace("独立运动的数量", "独立运动参数的新表述"), encoding="utf-8")
    second = saved(call, "textbook.import", {**params, "textbook_id": first["textbook_id"]})
    assert second["version"] == 2 and second["id"] != first["id"]
    latest = call("knowledge.search", {"course_id": course["id"], "query": "自由度"})["data"]["items"]
    assert latest and all(item["version_id"] == second["id"] for item in latest)
    original = call("knowledge.search", {"course_id": course["id"], "version_id": first["id"], "query": "自由度"})["data"]["items"]
    assert original[0]["version_id"] == first["id"]
    root = first["chapters"][0]
    subtree = call("knowledge.search", {"course_id": course["id"], "version_id": first["id"], "chapter_id": root["id"], "query": "自由度"})["data"]["items"]
    assert subtree and subtree[0]["chapter_id"] != root["id"]


def test_chunk_upload_replay_integrity_and_finish(teacher):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "上传测试"})
    content = TEXT.encode("utf-8")
    upload = saved(call, "textbook.upload.begin", {"course_id": course["id"], "title": "分块教材", "filename": "book.txt", "total_bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    assert call("textbook.upload.finish", {"id": upload["id"]}, "premature")["error"]["code"] == "incomplete_upload"
    split = len(content) // 2
    chunk = {"id": upload["id"], "offset": 0, "content_base64": base64.b64encode(content[:split]).decode()}
    first = saved(call, "textbook.upload.chunk", chunk)
    assert saved(call, "textbook.upload.chunk", chunk) == first
    bad = {**chunk, "content_base64": base64.b64encode(b"X" * split).decode()}
    assert call("textbook.upload.chunk", bad, "bad-replay")["error"]["code"] == "upload_conflict"
    saved(call, "textbook.upload.chunk", {"id": upload["id"], "offset": split, "content_base64": base64.b64encode(content[split:]).decode()})
    version = saved(call, "textbook.upload.finish", {"id": upload["id"]})
    assert saved(call, "textbook.upload.finish", {"id": upload["id"]})["id"] == version["id"]
    assert version["sha256"] == hashlib.sha256(content).hexdigest()


def test_short_chinese_query_and_untrusted_query_characters(teacher, tmp_path):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "中文检索测试"})
    path = make_book(tmp_path, ".txt")
    saved(call, "textbook.import", {"course_id": course["id"], "title": "测试教材", "path": str(path)})
    short = call("knowledge.search", {"course_id": course["id"], "query": "关节"})
    assert short["ok"] and short["data"]["items"]
    quoted = call("knowledge.search", {"course_id": course["id"], "query": '" OR * ( ) --'})
    assert quoted["ok"], quoted
    assert call("course.list")["data"]["items"][0]["title"] == "中文检索测试"


def test_invalid_file_and_cross_course_version_rejected(teacher, tmp_path):
    _, _, call = teacher
    first_course = saved(call, "course.create", {"title": "课程一"})
    other_course = saved(call, "course.create", {"title": "课程二"})
    bad = tmp_path / "invalid.docx"
    bad.write_bytes(b"not an Office file")
    failure = call("textbook.import", {"course_id": first_course["id"], "title": "损坏教材", "path": str(bad)}, "bad-office")
    assert failure["error"]["code"] == "invalid_textbook"
    assert call("textbook.list", {"course_id": first_course["id"]})["data"]["items"] == []
    path = make_book(tmp_path, ".txt")
    book = saved(call, "textbook.import", {"course_id": first_course["id"], "title": "课程一教材", "path": str(path)})
    mismatch = call("textbook.import", {"course_id": other_course["id"], "textbook_id": book["textbook_id"], "title": "错误课程", "path": str(path)}, "wrong-course")
    assert mismatch["error"]["code"] == "association_conflict"


def test_schema_one_upgrade_retains_course_and_foreign_keys(teacher):
    home, manager, call = teacher
    module = manager._plugins["teacher-assistant"].module
    import sys
    database_module = sys.modules[module.TeachingService.__module__].database.__module__
    db_api = sys.modules[database_module]
    path = home / "plugin-data" / "teacher-assistant" / "teaching.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    identifier = str(uuid4())
    with sqlite3.connect(path) as conn:
        for statement in db_api.SCHEMA:
            conn.execute(statement)
        conn.execute("INSERT INTO courses(id,title,period_minutes,period_count,break_minutes) VALUES(?,?,40,2,10)", (identifier, "旧版真实课程"))
        conn.execute("PRAGMA user_version=1")
    assert call("course.get", {"id": identifier})["data"]["title"] == "旧版真实课程"
    with sqlite3.connect(path) as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 2
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_semantic_opt_in_reranks_real_sources_and_rejects_fabricated_ids(teacher, tmp_path, monkeypatch):
    from agent.plugin_llm import PluginLlm, PluginLlmStructuredResult

    home, _, call = teacher
    course = saved(call, "course.create", {"title": "语义检索测试"})
    path = make_book(tmp_path, ".txt")
    saved(call, "textbook.import", {"course_id": course["id"], "title": "语义测试教材", "path": str(path)})
    source = call("knowledge.search", {"course_id": course["id"], "query": "自由度"})["data"]["items"][0]
    invocations = []

    def complete(self, **kwargs):
        invocations.append(kwargs)
        parsed = {"terms": ["自由度"]} if kwargs["schema_name"] == "ExpandedQuery" else {"source_ids": [source["id"]]}
        return PluginLlmStructuredResult("", "test", "scripted", "test", parsed=parsed, content_type="json")

    monkeypatch.setattr(PluginLlm, "complete_structured", complete)
    params = {"course_id": course["id"], "query": "机械臂能够独立运动的数量", "allow_model_call": True}
    assert call("knowledge.semantic", params)["error"]["code"] == "model_call_not_authorized"
    assert not invocations
    assert call("settings.update", {"semantic_llm_enabled": True})["ok"]
    assert call("knowledge.semantic", {**params, "allow_model_call": False})["error"]["code"] == "model_call_not_authorized"
    result = call("knowledge.semantic", params)
    assert result["ok"], result
    assert result["data"]["items"][0] == source
    assert len(invocations) == 2
    with sqlite3.connect(home / "plugin-data" / "teacher-assistant" / "teaching.db") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_events WHERE entity_type='semantic_search'").fetchone()[0] == 1

    def fabricated(self, **kwargs):
        parsed = {"terms": ["自由度"]} if kwargs["schema_name"] == "ExpandedQuery" else {"source_ids": ["fabricated-source"]}
        return PluginLlmStructuredResult("", "test", "scripted", "test", parsed=parsed, content_type="json")

    monkeypatch.setattr(PluginLlm, "complete_structured", fabricated)
    assert call("knowledge.semantic", params)["error"]["code"] == "invalid_model_response"


def test_lesson_pins_sources_and_does_not_change_with_new_textbook_version(teacher, tmp_path):
    _, _, call = teacher
    course = saved(call, "course.create", {"title": "统一教学课次"})
    path = make_book(tmp_path, ".txt")
    params = {"course_id": course["id"], "title": "关联教材", "path": str(path)}
    original = saved(call, "textbook.import", params)
    source = call("knowledge.search", {"course_id": course["id"], "query": "自由度"})["data"]["items"][0]
    lesson_params = {"course_id": course["id"], "version_id": original["id"], "title": "机器人课次", "source_ids": [source["id"]]}
    lesson = saved(call, "lesson.create", lesson_params)
    assert lesson["sources"][0] == source
    assert lesson["timing"]["instruction_minutes"] == 80
    assert lesson["timing"]["span_minutes"] == 90
    path.write_text(TEXT + "新版本增加工作载荷说明。\n", encoding="utf-8")
    updated = saved(call, "textbook.import", {**params, "textbook_id": original["textbook_id"]})
    assert updated["id"] != original["id"]
    assert call("lesson.get", {"id": lesson["id"]})["data"] == lesson
    wrong = call("lesson.create", {**lesson_params, "version_id": updated["id"]}, "bad-source-version")
    assert wrong["error"]["code"] == "association_conflict"
