"""Local rendering is claimed before Office execution and compared with the actual source image."""

import hashlib
from io import BytesIO
import json
import logging
from pathlib import Path
import tempfile
from typing import Literal

from pydantic import Field

from .database import audit, database, encode, new_id
from .files import file_root, store_bytes
from .image_assets import read_asset, thumbnail
from .models import DomainError, Identifier
from . import office_render, reconstruction


logger = logging.getLogger(__name__)


class RenderBegin(Identifier):
    renderer: Literal["wps", "powerpoint"] = "wps"
    force_new: bool = Field(default=False, strict=True)


class RenderAsset(Identifier):
    variant: Literal["rendered", "difference"] = "rendered"


class RenderList(Identifier):
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=20, ge=1, le=100, strict=True)


def get_job(conn, data):
    row = conn.execute("SELECT * FROM slide_render_jobs WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "页面渲染任务不存在")
    result = dict(row)
    result["comparison"] = json.loads(result.pop("comparison_json"))
    return result


def list_jobs(conn, data):
    reconstruction.get_page(conn, data)
    rows = conn.execute("SELECT id FROM slide_render_jobs WHERE page_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?", (data.id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM slide_render_jobs WHERE page_id=?", (data.id,)).fetchone()[0]
    return {"items": [get_job(conn, Identifier(id=row[0])) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def begin(conn, data, actor):
    reconstruction.get_page(conn, data)
    office_render.powershell_command()
    previous = None if data.force_new else conn.execute("SELECT id FROM slide_render_jobs WHERE page_id=? AND renderer=? AND state IN ('queued','running','succeeded') ORDER BY created_at DESC LIMIT 1", (data.id, data.renderer)).fetchone()
    if previous:
        return get_job(conn, Identifier(id=previous[0]))
    exported = reconstruction.preview_page(conn, Identifier(id=data.id), actor)
    identifier = new_id()
    conn.execute("INSERT INTO slide_render_jobs(id,page_id,export_id,renderer) VALUES(?,?,?,?)", (identifier, data.id, exported["id"], data.renderer))
    result = get_job(conn, Identifier(id=identifier))
    audit(conn, "slide_render", identifier, "begin", actor, None, result)
    return result


def compare(reference, rendered):
    from PIL import Image, ImageChops, ImageStat

    with Image.open(BytesIO(reference)) as source, Image.open(BytesIO(rendered)) as target:
        expected = source.convert("RGB").resize(target.size, Image.Resampling.BILINEAR)
        difference = ImageChops.difference(expected, target.convert("RGB"))
        channels = difference.split()
        maximum = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
        histogram = maximum.histogram()
        metrics = {"mean_absolute_rgb_error": round(sum(ImageStat.Stat(difference).mean) / 3, 6),
                   "pixels_above_32_fraction": round(sum(histogram[33:]) / (target.width * target.height), 6),
                   "width": target.width, "height": target.height,
                   "method": "参考图双线性缩放至渲染尺寸后计算RGB绝对差，任一通道差值大于32的像素占比",
                   "review_note": "像素差异用于定位版式和颜色变化，文字与图解准确性仍需教师核对"}
        output = BytesIO()
        difference.save(output, format="PNG")
    return output.getvalue(), metrics


def execute(data, actor, request_id, **_context):
    if request_id != data.id:
        raise DomainError("invalid_request_id", "执行渲染时request_id需使用该任务ID")
    fingerprint = hashlib.sha256(encode(data.model_dump()).encode()).hexdigest()
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
        if receipt and (receipt["operation"] != "slide.render.run" or receipt["fingerprint"] != fingerprint):
            raise DomainError("idempotency_conflict", "渲染请求ID已用于其他操作")
        job = get_job(conn, data)
        if receipt or job["state"] != "queued":
            return job
        conn.execute("UPDATE slide_render_jobs SET state='running' WHERE id=?", (data.id,))
        conn.execute("INSERT INTO command_receipts VALUES(?,?,?,?)", (request_id, "slide.render.run", fingerprint, encode(get_job(conn, data))))
    result, error = {}, None
    try:
        with database() as conn:
            exported = dict(conn.execute("SELECT * FROM slide_deck_exports WHERE id=?", (job["export_id"],)).fetchone())
            reconstruction._checked_export(exported)
            page = reconstruction.get_page(conn, Identifier(id=job["page_id"]))
            asset, reference = read_asset(conn, Identifier(id=page["asset_id"]))
        with tempfile.TemporaryDirectory(prefix=".slide-render-", dir=file_root()) as folder:
            content, version = office_render.render(Path(exported["stored_path"]), Path(folder), job["renderer"])
        difference, comparison = compare(reference, content)
        path, digest = store_bytes(content, ".png")
        diff_path, diff_digest = store_bytes(difference, ".png")
        result = {"stored_path": str(path), "sha256": digest, "byte_size": len(content), "difference_path": str(diff_path),
                  "difference_sha256": diff_digest, "renderer_version": version,
                  "comparison": {**comparison, "reference_sha256": asset["sha256"], "pptx_sha256": exported["sha256"]}}
    except DomainError as exc:
        error = exc.code
    except OSError:
        error = "render_file_access_failed"
    except Exception:
        logger.exception("Local render job %s failed", data.id)
        error = "render_execution_failed"
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        before = get_job(conn, data)
        conn.execute("""UPDATE slide_render_jobs SET state=?,error_code=?,renderer_version=?,stored_path=?,sha256=?,byte_size=?,
            difference_path=?,difference_sha256=?,comparison_json=? WHERE id=?""", ("failed" if error else "succeeded", error,
            result.get("renderer_version"), result.get("stored_path"), result.get("sha256"), result.get("byte_size"),
            result.get("difference_path"), result.get("difference_sha256"), encode(result.get("comparison", {})), data.id))
        finished = get_job(conn, data)
        conn.execute("UPDATE command_receipts SET result_json=? WHERE request_id=?", (encode(finished), data.id))
        audit(conn, "slide_render", data.id, "finish", actor, before, finished)
        return finished


def _read_file(conn, data):
    job = get_job(conn, data)
    if job["state"] != "succeeded":
        raise DomainError("render_required", "页面尚无成功渲染结果")
    path = Path(job["stored_path"] if data.variant == "rendered" else job["difference_path"])
    digest = job["sha256"] if data.variant == "rendered" else job["difference_sha256"]
    if not path.resolve().is_relative_to(file_root().resolve()):
        raise DomainError("file_access_error", "预览文件不属于当前教师配置")
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != digest:
        raise DomainError("file_integrity_error", "页面预览文件哈希校验失败")
    return path, content


def preview(conn, data):
    _, content = _read_file(conn, data)
    return thumbnail(content)


def download(conn, data):
    path, _ = _read_file(conn, data)
    return {"stored_path": str(path), "filename": ("课件实际预览" if data.variant == "rendered" else "课件像素差异") + ".png"}
