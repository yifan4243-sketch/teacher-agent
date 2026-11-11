"""Real plan DOCX/XLSX/PDF bytes, filtered scopes and immutable teaching format boundaries."""

import hashlib
from pathlib import Path

from tests.extensions.test_teacher_foundation import saved, teacher
from tests.extensions.test_teacher_timetable import calendar_workspace

__all__ = ["calendar_workspace", "teacher"]


def test_plan_native_exports_scopes_caches_and_literal_spreadsheet_text(calendar_workspace):
    from docx import Document
    from openpyxl import load_workbook
    from pypdf import PdfReader

    call, _, params, plan = calendar_workspace
    outputs = {format_: saved(call, "plan.export", {"id": plan["id"], "format": format_}) for format_ in ("docx", "xlsx", "pdf")}
    for format_, result in outputs.items():
        path = Path(result["stored_path"])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == result["sha256"]
        assert saved(call, "plan.export", {"id": plan["id"], "format": format_})["id"] == result["id"]
        assert call("plan.export.file", {"id": result["id"]})["data"]["stored_path"] == str(path)
    document = Document(outputs["docx"]["stored_path"])
    assert document.sections[0].page_width > document.sections[0].page_height
    assert len(document.tables[0].rows) == 4
    assert document.tables[0].cell(1, 0).text == "1" and "休息" in document.tables[0].cell(1, 4).text
    sheet = load_workbook(outputs["xlsx"]["stored_path"], data_only=False).active
    assert sheet.max_row == 8 and sheet["F6"].value == 80 and sheet["G6"].value == 0
    assert sheet["A6"].value == 1 and sheet.freeze_panes == "A6"
    pdf = PdfReader(outputs["pdf"]["stored_path"])
    assert len(pdf.pages) >= 1 and "教学计划" in "".join(page.extract_text() for page in pdf.pages)
    week = next(iter(plan["weeks"]))
    filtered = saved(call, "plan.export", {"id": plan["id"], "format": "xlsx", "scope": "week", "key": week})
    assert load_workbook(filtered["stored_path"]).active.max_row == 6
    month = next(iter(plan["months"]))
    monthly = saved(call, "plan.export", {"id": plan["id"], "format": "docx", "scope": "month", "key": month})
    assert month in Document(monthly["stored_path"]).paragraphs[0].text
    assert call("plan.export", {"id": plan["id"], "format": "xlsx", "scope": "month", "key": "1900-01"}, "unknown-month")["error"]["code"] == "invalid_scope"
    assert call("plan.export", {"id": plan["id"], "format": "csv"}, "unsupported-format")["error"]["code"] == "invalid_input"
    published = saved(call, "plan.publish", {"id": plan["id"], "review_note": "测试发布后导出标注"})
    formal = saved(call, "plan.export", {"id": plan["id"], "format": "docx"})
    assert formal["id"] != outputs["docx"]["id"] and "已发布计划" in Document(formal["stored_path"]).paragraphs[1].text
    dangerous = saved(call, "plan.save", {**params, "title": '=HYPERLINK("https://example.invalid","data")' + "课程计划" * 30, "parent_id": plan["id"]})
    output = saved(call, "plan.export", {"id": dangerous["id"], "format": "xlsx"})
    workbook = load_workbook(output["stored_path"], data_only=False)
    assert workbook.active["A1"].data_type == "s" and workbook.active["A1"].value.startswith("=HYPERLINK")
    assert workbook.active.row_dimensions[1].height > 35
    assert not any(cell.data_type == "f" for row in workbook.active for cell in row)
    saved(call, "plan.publish", {"id": dangerous["id"], "replaces_publication_id": published["id"], "review_note": "测试历史版本标注"})
    historical = saved(call, "plan.export", {"id": plan["id"], "format": "docx"})
    assert "历史计划" in Document(historical["stored_path"]).paragraphs[1].text
    assert published["events"][0]["source_plan_id"] == plan["id"]


def test_plan_export_hashes_and_teaching_docx_only_boundary(calendar_workspace):
    call, lesson, _, plan = calendar_workspace
    output = saved(call, "plan.export", {"id": plan["id"], "format": "pdf"})
    Path(output["stored_path"]).write_bytes(b"tampered fixture")
    assert call("plan.export.file", {"id": output["id"]})["error"]["code"] == "file_integrity_error"
    assert call("plan.export", {"id": plan["id"], "format": "pdf"}, "bad-cache")["error"]["code"] == "file_integrity_error"
    assert call("document.export", {"id": lesson["id"], "format": "pdf"}, "teaching-pdf-blocked")["error"]["code"] == "invalid_input"
    assert call("plan.export", {"id": lesson["id"], "format": "pdf"}, "wrong-plan-id")["error"]["code"] == "not_found"
