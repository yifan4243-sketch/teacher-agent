"""Immutable, bounded optional style images and explicit per-job transmission consent."""

import base64
import binascii
import hashlib
from io import BytesIO
from pathlib import Path

from pydantic import Field

from .database import audit, new_id
from .documents import get_document
from .files import file_root, store_bytes
from .image_assets import thumbnail
from .image_models import ImageReserve, ImageList
from .models import DomainError, Identifier, Input


class ReferenceUpload(Input):
    blueprint_id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    source_note: str = Field(default="", max_length=1000)
    content_base64: str = Field(min_length=4, max_length=2_800_000)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ReferenceReserve(ImageReserve):
    reference_id: str = Field(min_length=1, max_length=64)
    allow_reference_upload: bool = Field(default=False, strict=True)


def get_reference(conn, data):
    row = conn.execute("SELECT * FROM slide_references WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "参考素材不存在")
    return dict(row)


def list_references(conn, data: ImageList):
    get_document(conn, Identifier(id=data.blueprint_id))
    rows = conn.execute("SELECT * FROM slide_references WHERE blueprint_id=? ORDER BY created_at,id LIMIT ? OFFSET ?",
                        (data.blueprint_id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM slide_references WHERE blueprint_id=?", (data.blueprint_id,)).fetchone()[0]
    return {"items": [{key: value for key, value in dict(row).items() if key != "stored_path"} for row in rows],
            "total": total, "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def upload(conn, data, actor):
    from PIL import Image, UnidentifiedImageError

    document = get_document(conn, Identifier(id=data.blueprint_id))
    if document["kind"] != "slide_blueprint":
        raise DomainError("invalid_input", "参考素材需要关联课件蓝图")
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DomainError("invalid_image", "参考图编码不正确") from exc
    if not 0 < len(content) <= 2 * 1024 * 1024 or hashlib.sha256(content).hexdigest() != data.sha256:
        raise DomainError("invalid_image", "参考图需不超过2MB并通过上传哈希校验")
    try:
        with Image.open(BytesIO(content)) as image:
            width, height, format_ = image.width, image.height, image.format
            if format_ not in ("PNG", "JPEG", "WEBP") or getattr(image, "n_frames", 1) != 1:
                raise DomainError("invalid_image", "参考图需要静态PNG、JPEG或WEBP")
            if min(width, height) < 64 or max(width, height) > 8192 or width * height > 16_000_000:
                raise DomainError("invalid_image", "参考图边长需为64–8192像素且总像素不超过1600万")
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise DomainError("invalid_image", "参考图文件未通过图像校验") from exc
    path, digest = store_bytes(content, {"PNG": ".png", "JPEG": ".jpg", "WEBP": ".webp"}[format_])
    identifier = new_id()
    conn.execute("""INSERT INTO slide_references(id,blueprint_id,label,source_note,stored_path,sha256,width,height,format)
        VALUES(?,?,?,?,?,?,?,?,?)""", (identifier, data.blueprint_id, data.label, data.source_note, str(path), digest, width, height, format_))
    result = get_reference(conn, Identifier(id=identifier))
    audit(conn, "slide_reference", identifier, "upload_local", actor, None, result)
    return result


def checked_bytes(reference):
    path = Path(reference["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()):
        raise DomainError("file_access_error", "参考素材不属于当前教师配置")
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != reference["sha256"]:
        raise DomainError("file_integrity_error", "参考素材的哈希校验失败")
    return content


def preview(conn, data):
    return thumbnail(checked_bytes(get_reference(conn, data)))


def archive(conn, data, actor):
    before = get_reference(conn, data)
    conn.execute("UPDATE slide_references SET archived=1 WHERE id=?", (data.id,))
    result = get_reference(conn, data)
    audit(conn, "slide_reference", data.id, "archive", actor, before, result)
    return result


def for_reservation(conn, data):
    if not isinstance(data, ReferenceReserve):
        return None
    if not data.allow_reference_upload:
        raise DomainError("reference_upload_not_authorized", "请明确授权将所选参考图发送给当前生图服务")
    reference = get_reference(conn, Identifier(id=data.reference_id))
    if reference["blueprint_id"] != data.id or reference["archived"]:
        raise DomainError("association_conflict", "请选择当前蓝图中尚未归档的参考素材")
    checked_bytes(reference)
    return reference


def job_reference(conn, identifier):
    row = conn.execute("""SELECT r.* FROM slide_job_references j JOIN slide_references r ON r.id=j.reference_id
        WHERE j.job_id=? AND j.sha256=r.sha256""", (identifier,)).fetchone()
    return dict(row) if row else None
