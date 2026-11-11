"""Reviewed native slide versions and immutable, complete PPTX exports."""

import hashlib
import json
from pathlib import Path
import tempfile
from typing import Literal

from pydantic import Field

from .database import audit, encode, new_id
from .documents import get_document
from .files import file_root, store_bytes
from .image_analysis import layout_text_check
from .image_assets import read_asset
from .image_models import ImageList
from .images import get_job
from .models import DomainError, Identifier
from .slides import SlideLayout, export_pptx


class PageFromAnalysis(Identifier):
    expected_version: int = Field(default=0, ge=0, strict=True)


class PageRevision(Identifier):
    layout: SlideLayout


class PageReview(Identifier):
    decision: Literal["approved", "rejected"]
    note: str = Field(min_length=1, max_length=2000)


class PageList(ImageList):
    page_number: int | None = Field(default=None, ge=1, le=200, strict=True)


def _page_content(conn, blueprint_id, page_number):
    blueprint = get_document(conn, Identifier(id=blueprint_id))
    if blueprint["kind"] != "slide_blueprint" or blueprint["status"] != "approved":
        raise DomainError("review_required", "可编辑页面需要已审核蓝图")
    return next(page for page in blueprint["content"]["pages"] if page["number"] == page_number)


def get_page(conn, data):
    row = conn.execute("SELECT * FROM slide_pages WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "可编辑页面不存在")
    page = dict(row)
    page["layout"] = json.loads(page.pop("layout_json"))
    layout = SlideLayout.model_validate(page["layout"])
    page["text_check"] = layout_text_check(layout, _page_content(conn, page["blueprint_id"], page["page_number"]))
    page["object_counts"] = {kind: sum(element.kind == kind for element in layout.elements) for kind in ("text", "shape", "line", "table", "image")}
    repair = conn.execute("SELECT * FROM slide_page_repairs WHERE page_id=?", (data.id,)).fetchone()
    page["repair"] = {"render_job_id": repair["render_job_id"], "minimum_font_pixels": repair["minimum_font_pixels"], "report": json.loads(repair["report_json"])} if repair else None
    return page


def list_pages(conn, data):
    get_document(conn, Identifier(id=data.blueprint_id))
    where = """blueprint_id=? AND (? IS NULL OR page_number=?) AND (? IS NOT NULL OR version=(
        SELECT MAX(p2.version) FROM slide_pages p2 WHERE p2.blueprint_id=slide_pages.blueprint_id AND p2.page_number=slide_pages.page_number))"""
    scope = (data.blueprint_id, data.page_number, data.page_number, data.page_number)
    rows = conn.execute(f"""SELECT id,blueprint_id,page_number,version,parent_id,status FROM slide_pages WHERE {where}
        ORDER BY page_number,version DESC LIMIT ? OFFSET ?""", (*scope, data.limit, data.offset)).fetchall()
    total = conn.execute(f"SELECT COUNT(*) FROM slide_pages WHERE {where}", scope).fetchone()[0]
    return {"items": [dict(row) for row in rows], "total": total, "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def _save_page(conn, blueprint_id, page_number, expected_version, analysis_id, asset_id, layout, actor):
    _page_content(conn, blueprint_id, page_number)
    latest = conn.execute("SELECT id,version FROM slide_pages WHERE blueprint_id=? AND page_number=? ORDER BY version DESC LIMIT 1", (blueprint_id, page_number)).fetchone()
    if expected_version != (latest["version"] if latest else 0):
        raise DomainError("version_conflict", "可编辑页面已有更新版本，请刷新后修订")
    asset, _ = read_asset(conn, Identifier(id=asset_id))
    if (layout.width, layout.height) != (asset["width"], asset["height"]) or abs(layout.width / layout.height - 16 / 9) > 0.005:
        raise DomainError("invalid_slide_dimensions", "页面画布需与16比9设计图尺寸一致")
    identifier = new_id()
    conn.execute("""INSERT INTO slide_pages(id,blueprint_id,page_number,version,parent_id,analysis_id,asset_id,layout_json,created_by)
        VALUES(?,?,?,?,?,?,?,?,?)""", (identifier, blueprint_id, page_number, expected_version + 1, latest["id"] if latest else None, analysis_id, asset_id, encode(layout.model_dump()), actor))
    result = get_page(conn, Identifier(id=identifier))
    audit(conn, "slide_page", identifier, "save_version", actor, None, result)
    return result


def from_analysis(conn, data, actor):
    job = get_job(conn, data)
    if job["kind"] != "analysis" or job["state"] != "succeeded" or not job["analysis"].get("layout"):
        raise DomainError("analysis_required", "请先完成当前图片的视觉布局提取")
    asset, _ = read_asset(conn, Identifier(id=job["input_asset_id"]))
    if asset["verification_status"] != "approved" or asset["sha256"] != job["analysis"]["asset_sha256"]:
        raise DomainError("review_required", "请先由教师核对并通过当前设计图")
    return _save_page(conn, job["blueprint_id"], job["page_number"], data.expected_version, data.id,
                      asset["id"], SlideLayout.model_validate(job["analysis"]["layout"]), actor)


def revise(conn, data, actor):
    before = get_page(conn, data)
    return _save_page(conn, before["blueprint_id"], before["page_number"], before["version"], before["analysis_id"], before["asset_id"], data.layout, actor)


def review(conn, data, actor):
    before = get_page(conn, data)
    if before["status"] != "draft":
        raise DomainError("invalid_transition", "页面审核结果已保存，修改需要另存新版本")
    if data.decision == "approved":
        if before["text_check"]["missing_text"]:
            raise DomainError("slide_text_mismatch", "页面缺少蓝图的准确文字，请修订可编辑文字后审核")
    conn.execute("UPDATE slide_pages SET status=?,reviewed_by=?,review_note=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                 (data.decision, actor, data.note, data.id))
    result = get_page(conn, data)
    audit(conn, "slide_page", data.id, "teacher_review", actor, before, result)
    return result


def _export(conn, blueprint_id, pages, actor):
    selection = [{"id": page["id"], "page_number": page["page_number"], "version": page["version"]} for page in pages]
    selection_hash = hashlib.sha256(encode(selection).encode()).hexdigest()
    cached = conn.execute("SELECT * FROM slide_deck_exports WHERE blueprint_id=? AND selection_hash=?", (blueprint_id, selection_hash)).fetchone()
    if cached:
        return _checked_export(dict(cached))
    image_sources = []
    for page in pages:
        source = None
        if any(element["kind"] == "image" for element in page["layout"]["elements"]):
            asset, _ = read_asset(conn, Identifier(id=page["asset_id"]))
            source = asset["stored_path"]
        image_sources.append(source)
    with tempfile.TemporaryDirectory(prefix=".editable-slides-", dir=file_root()) as work:
        path = export_pptx([page["layout"] for page in pages], Path(work) / "deck.pptx", source_images=image_sources)
        content = path.read_bytes()
    stored, digest = store_bytes(content, ".pptx")
    identifier = new_id()
    filename = "可编辑课件-" + (f"第{pages[0]['page_number']}页-v{pages[0]['version']}" if len(pages) == 1 else f"{len(pages)}页") + ".pptx"
    conn.execute("INSERT INTO slide_deck_exports(id,blueprint_id,selection_hash,pages_json,stored_path,sha256,byte_size,filename) VALUES(?,?,?,?,?,?,?,?)",
                 (identifier, blueprint_id, selection_hash, encode(selection), str(stored), digest, len(content), filename))
    result = dict(conn.execute("SELECT * FROM slide_deck_exports WHERE id=?", (identifier,)).fetchone())
    audit(conn, "slide_deck", identifier, "export_native_pptx", actor, None, result)
    return result


def export_page(conn, data, actor):
    page = get_page(conn, data)
    if page["status"] != "approved":
        raise DomainError("review_required", "单页PPTX导出需要教师审核该版本")
    return _export(conn, page["blueprint_id"], [page], actor)


def preview_page(conn, data, actor):
    page = get_page(conn, data)
    result = _export(conn, page["blueprint_id"], [page], actor)
    return {**result, "filename": "预览草稿-" + result["filename"]}


def export_deck(conn, data, actor):
    document = get_document(conn, data)
    if document["kind"] != "slide_blueprint" or document["status"] != "approved":
        raise DomainError("review_required", "完整课件需要已审核蓝图")
    pages = []
    for content in document["content"]["pages"]:
        row = conn.execute("SELECT id FROM slide_pages WHERE blueprint_id=? AND page_number=? AND status='approved' ORDER BY version DESC LIMIT 1", (data.id, content["number"])).fetchone()
        if row is None:
            raise DomainError("incomplete_deck", f"第{content['number']}页尚无已审核的可编辑版本")
        pages.append(get_page(conn, Identifier(id=row[0])))
    return _export(conn, data.id, pages, actor)


def _checked_export(result):
    path = Path(result["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != result["sha256"]:
        raise DomainError("file_integrity_error", "课件文件未通过哈希校验")
    return result
