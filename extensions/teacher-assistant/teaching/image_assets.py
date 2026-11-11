"""Immutable original images, lossless canvas padding and local teacher review."""

import base64
import hashlib
from io import BytesIO
import math
from pathlib import Path
from typing import Literal

from pydantic import Field

from .database import audit, encode, new_id
from .files import file_root, store_bytes
from .models import DomainError, Identifier
from .native_images import read_design_image


class ImageReview(Identifier):
    expected_version: int = Field(ge=0, strict=True)
    decision: Literal["approved", "rejected"]
    note: str = Field(min_length=1, max_length=2000)


def store_design(path, background):
    from PIL import Image

    content, dimensions, correct_ratio = read_design_image(path)
    suffix = {"PNG": ".png", "JPEG": ".jpg", "WEBP": ".webp"}[dimensions["format"]]
    stored, digest = store_bytes(content, suffix)
    original = {"id": new_id(), "stored_path": str(stored), "sha256": digest, "byte_size": len(content), **dimensions,
                "verification_status": "needs_text_review" if correct_ratio else "aspect_ratio_mismatch",
                "source_asset_id": None, "processing_json": "{}"}
    assets = [original]
    if correct_ratio:
        return assets
    # Increase the canvas only. Cropping or stretching would change text and diagram geometry.
    unit = math.ceil(max(dimensions["width"] / 16, dimensions["height"] / 9))
    size = (16 * unit, 9 * unit)
    if max(size) > 8192 or size[0] * size[1] > 64_000_000:
        return assets
    offset = ((size[0] - dimensions["width"]) // 2, (size[1] - dimensions["height"]) // 2)
    with Image.open(BytesIO(content)) as image:
        canvas = Image.new("RGB", size, "#" + background)
        rgba = image.convert("RGBA")
        canvas.paste(rgba, offset, rgba)
        output = BytesIO()
        canvas.save(output, format="PNG")
    padded = output.getvalue()
    if len(padded) > 30 * 1024 * 1024:
        return assets
    stored, digest = store_bytes(padded, ".png")
    assets.append({"id": new_id(), "stored_path": str(stored), "sha256": digest, "byte_size": len(padded),
                   "width": size[0], "height": size[1], "format": "PNG", "verification_status": "needs_text_review",
                   "source_asset_id": original["id"], "processing_json": encode({"method": "canvas_padding", "offset": offset,
                    "background": background, "original_size": [dimensions["width"], dimensions["height"]], "scaled": False, "cropped": False})})
    return assets


def get_asset(conn, data):
    row = conn.execute("SELECT * FROM slide_image_assets WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "设计图文件不存在")
    return dict(row)


def read_asset(conn, data):
    asset = get_asset(conn, data)
    path = Path(asset["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()):
        raise DomainError("file_access_error", "设计图文件不属于当前教师配置")
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != asset["sha256"]:
        raise DomainError("file_integrity_error", "设计图文件哈希校验失败")
    return asset, content


def download(conn, data):
    asset, _ = read_asset(conn, data)
    suffix = {"PNG": ".png", "JPEG": ".jpg", "WEBP": ".webp"}[asset["format"]]
    return {"stored_path": asset["stored_path"], "filename": "教学设计图-" + asset["sha256"][:12] + suffix}


def preview(conn, data):
    _, content = read_asset(conn, data)
    return thumbnail(content)


def thumbnail(content):
    from PIL import Image

    with Image.open(BytesIO(content)) as image:
        image.thumbnail((1280, 720))
        output = BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=85)
    return {"content_base64": base64.b64encode(output.getvalue()).decode("ascii"), "mime_type": "image/jpeg"}


def review(conn, data, actor):
    before, _ = read_asset(conn, data)
    if before["review_version"] != data.expected_version:
        raise DomainError("version_conflict", "图片已被其他审核更新，请刷新后复核")
    current = conn.execute("SELECT state,asset_id FROM slide_image_jobs WHERE id=?", (before["job_id"],)).fetchone()
    if current["state"] not in {"succeeded", "cached"} or current["asset_id"] != data.id:
        raise DomainError("review_required", "只能审核成功任务的当前设计图，取消后的历史结果须另行生成新任务")
    conn.execute("""UPDATE slide_image_assets SET verification_status=?,review_note=?,reviewed_by=?,review_version=review_version+1,
        reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?""", (data.decision, data.note, actor, data.id))
    result = get_asset(conn, data)
    audit(conn, "slide_image_asset", data.id, "teacher_review", actor, before, result)
    return result
