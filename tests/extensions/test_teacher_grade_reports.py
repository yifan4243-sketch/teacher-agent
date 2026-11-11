"""Reviewed report bytes, history, identity updates, private access and file consistency."""

from importlib import import_module
from pathlib import Path
import sqlite3
import sys

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_grading import assessment_workspace, review_payload

__all__ = ["assessment_workspace", "teacher"]


def _published(workspace):
    home, call, lesson, paper, student, answers = workspace
    submission = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": answers})
    draft = saved(call, "grading.score", {"id": submission["id"]})
    grade = saved(call, "grading.publish", review_payload(draft))
    return home, call, lesson, paper, student, submission, draft, grade


def test_reviewed_grade_docx_pdf_content_privacy_and_integrity(assessment_workspace):
    from docx import Document
    from pypdf import PdfReader

    _, call, _, paper, student, submission, draft, grade = _published(assessment_workspace)
    assert call("grade.export", {"id": draft["id"], "format": "docx"}, "unpublished-report")["error"]["code"] == "not_found"
    for format_ in ("docx", "pdf"):
        data = {"id": grade["id"], "format": format_}
        assert not tool("grade.export", data, "agent-report-" + format_, name="teacher_assessment")["ok"]
        asset = saved(call, "grade.export", data)
        assert saved(call, "grade.export", data)["id"] == asset["id"]
        assert call("grade.export.file", {"id": asset["id"]})["data"]["sha256"] == asset["sha256"]
        path = Path(asset["stored_path"])
        if format_ == "docx":
            document = Document(path)
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
            assert not document.inline_shapes
        else:
            text = "\n".join(page.extract_text() for page in PdfReader(path).pages)
        for expected in (paper["title"] + "批改报告", student["name"], student["student_number"], "24.01分", "25.01分",
                         "北京时间", "答卷版本1", "学生作答", "教师评分意见", "评分要点", "教材依据", grade["id"]):
            assert expected in text
        assert submission["answers"][-1]["content"]["text"] in text
        path.write_bytes(b"damaged-report")
        assert call("grade.export.file", {"id": asset["id"]})["error"]["code"] == "file_integrity_error"
        assert call("grade.export", data, "damaged-" + format_)["error"]["code"] == "file_integrity_error"


def test_report_history_and_identity_updates_create_new_immutable_files(assessment_workspace):
    from docx import Document

    _, call, _, _, student, submission, draft, first = _published(assessment_workspace)
    original = saved(call, "grade.export", {"id": first["id"], "format": "docx"})
    original_bytes = Path(original["stored_path"]).read_bytes()
    changed_student = saved(call, "student.update", {"id": student["id"], "version": student["version"], "name": "更正后的虚构姓名"})
    renamed = saved(call, "grade.export", {"id": first["id"], "format": "docx"})
    assert renamed["id"] != original["id"] and renamed["source_hash"] != original["source_hash"]
    assert renamed["filename"] != original["filename"]
    assert Path(original["stored_path"]).read_bytes() == original_bytes
    assert "更正后的虚构姓名" in "\n".join(paragraph.text for paragraph in Document(renamed["stored_path"]).paragraphs)
    revised_draft = saved(call, "grading.score", {"id": submission["id"], "expected_version": draft["version"]})
    revised = saved(call, "grading.publish", review_payload(revised_draft, subjective=500, current=first["id"]))
    assert not call("grade.get", {"id": first["id"]})["data"]["active"]
    assert saved(call, "grade.export", {"id": first["id"], "format": "docx"})["id"] == renamed["id"]
    latest = saved(call, "grade.export", {"id": revised["id"], "format": "pdf"})
    assert latest["grade_id"] != renamed["grade_id"]
    saved(call, "student.update", {"id": student["id"], "version": changed_student["version"], "archived": True})
    assert saved(call, "grade.export", {"id": revised["id"], "format": "pdf"})["id"] == latest["id"]


def test_report_file_write_failure_rolls_back_export_record(assessment_workspace, teacher, monkeypatch):
    home, call, _, _, _, _, _, grade = _published(assessment_workspace)
    manager = teacher[1]
    package = sys.modules[manager._plugins["teacher-assistant"].module.TeachingService.__module__].__package__
    files = import_module(".files", package)
    def fail_write(*args, **kwargs):
        raise OSError("injected write failure")
    with monkeypatch.context() as context:
        context.setattr(files.os, "fsync", fail_write)
        denied = call("grade.export", {"id": grade["id"], "format": "pdf"}, "write-failure")
    assert not denied["ok"] and denied["error"]["code"] == "file_access_error"
    assert not list(files.file_root().glob(".staging-*"))
    with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
        assert conn.execute("SELECT COUNT(*) FROM grade_exports").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM grade_publications WHERE active=1").fetchone()[0] == 1
    assert saved(call, "grade.export", {"id": grade["id"], "format": "pdf"}, "write-failure")["grade_id"] == grade["id"]
