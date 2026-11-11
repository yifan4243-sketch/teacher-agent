"""Store original answer files and render owned pages using existing document dependencies."""

import base64
import hashlib
from io import BytesIO
from pathlib import Path

from .database import audit, new_id
from .exams import get_paper
from .files import check_owned_export, store_bytes, upload_path, write_upload_chunk
from .models import DomainError, Identifier
from .submissions import check_student


def get_file(conn, data):
    row = conn.execute("SELECT * FROM answer_files WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "答卷文件不存在")
    return dict(row)


def list_files(conn, data):
    get_paper(conn, data)
    params = (data.id, data.student_id, data.student_id)
    rows = conn.execute("SELECT * FROM answer_files WHERE paper_id=? AND (? IS NULL OR student_id=?) ORDER BY rowid DESC LIMIT ? OFFSET ?", (*params, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM answer_files WHERE paper_id=? AND (? IS NULL OR student_id=?)", params).fetchone()[0]
    return {"items": [{key: value for key, value in dict(row).items() if key != "stored_path"} for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def begin_upload(conn, data, actor):
    if "/" in data.filename or "\\" in data.filename or "\x00" in data.filename or Path(data.filename).suffix.lower() not in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
        raise DomainError("unsupported_format", "答卷支持PDF、PNG、JPEG和WEBP文件")
    paper = get_paper(conn, Identifier(id=data.paper_id))
    if paper["status"] != "approved":
        raise DomainError("review_required", "请选择已审核试卷后上传学生答卷")
    check_student(conn, paper["plan"]["course_id"], data.student_id)
    identifier = new_id()
    with upload_path(identifier).open("xb"):
        pass
    conn.execute("INSERT INTO answer_uploads(id,paper_id,student_id,filename,total_bytes,sha256) VALUES(?,?,?,?,?,?)",
        (identifier, data.paper_id, data.student_id, data.filename, data.total_bytes, data.sha256))
    return {"id": identifier, "bytes_received": 0}


def _upload(conn, identifier):
    row = conn.execute("SELECT * FROM answer_uploads WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise DomainError("not_found", "答卷上传任务不存在")
    return row


def upload_chunk(conn, data, actor):
    row = _upload(conn, data.id)
    received = write_upload_chunk(row, data)
    conn.execute("UPDATE answer_uploads SET bytes_received=? WHERE id=?", (received, data.id))
    return {"id": data.id, "bytes_received": received}


def _pdf(content):
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise DomainError("dependency_not_ready", "请通过Hermes包管理准备教师插件的PDF渲染依赖") from exc
    try:
        return pdfium.PdfDocument(content)
    except (pdfium.PdfiumError, ValueError) as exc:
        raise DomainError("invalid_answer_file", "答卷PDF无法打开，请检查文件或密码保护状态") from exc


def _inspect(content, filename):
    from PIL import Image, UnidentifiedImageError

    if Path(filename).suffix.lower() == ".pdf":
        with _pdf(content) as document:
            count = len(document)
        if not 1 <= count <= 200:
            raise DomainError("invalid_answer_file", "答卷PDF需包含1至200页")
        return ".pdf", "application/pdf", count
    try:
        with Image.open(BytesIO(content)) as image:
            if image.width * image.height > 64_000_000 or image.format not in {"PNG", "JPEG", "WEBP"} or getattr(image, "n_frames", 1) != 1:
                raise DomainError("invalid_answer_file", "答卷图片需为静态PNG、JPEG或WEBP，总像素不超过6400万")
            format_ = image.format
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise DomainError("invalid_answer_file", "答卷文件未通过图像校验") from exc
    suffix, mime = {"PNG": (".png", "image/png"), "JPEG": (".jpg", "image/jpeg"), "WEBP": (".webp", "image/webp")}[format_]
    return suffix, mime, 1


def finish_upload(conn, data, actor):
    row = _upload(conn, data.id)
    if row["result_file_id"]:
        return get_file(conn, Identifier(id=row["result_file_id"]))
    content = upload_path(data.id).read_bytes()
    if row["bytes_received"] != row["total_bytes"] or len(content) != row["total_bytes"]:
        raise DomainError("incomplete_upload", "答卷文件尚未上传完整")
    if hashlib.sha256(content).hexdigest() != row["sha256"]:
        raise DomainError("file_integrity_error", "答卷上传文件哈希不一致")
    paper = get_paper(conn, Identifier(id=row["paper_id"]))
    check_student(conn, paper["plan"]["course_id"], row["student_id"])
    suffix, mime, count = _inspect(content, row["filename"])
    path, digest = store_bytes(content, suffix)
    identifier = new_id()
    conn.execute("""INSERT INTO answer_files(id,paper_id,student_id,filename,stored_path,sha256,byte_size,mime_type,page_count)
        VALUES(?,?,?,?,?,?,?,?,?)""", (identifier, row["paper_id"], row["student_id"], row["filename"], str(path), digest, len(content), mime, count))
    conn.execute("UPDATE answer_uploads SET status='ready',result_file_id=? WHERE id=?", (identifier, data.id))
    result = get_file(conn, Identifier(id=identifier))
    audit(conn, "answer_file", identifier, "upload", actor, None, result)
    return result


def _render(file, page_number):
    from PIL import Image, ImageOps

    check_owned_export(file, "原始答卷")
    content = Path(file["stored_path"]).read_bytes()
    if file["mime_type"] == "application/pdf":
        with _pdf(content) as document:
            page = document[page_number - 1]
            try:
                width, height = page.get_size()
                bitmap = page.render(scale=min(3, 2560 / max(width, height)))
                try:
                    rendered = bitmap.to_pil().copy()
                finally:
                    bitmap.close()
            finally:
                page.close()
    else:
        with Image.open(BytesIO(content)) as image:
            rendered = ImageOps.exif_transpose(image).convert("RGBA")
    rgba = rendered.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, "white")
    canvas.paste(rgba, mask=rgba.getchannel("A"))
    canvas.thumbnail((2560, 2560))
    output = BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue(), canvas.size


def get_page(conn, data, actor):
    file = get_file(conn, data)
    if data.page_number > file["page_count"]:
        raise DomainError("invalid_page", "答卷页号超出实际页数")
    cached = conn.execute("SELECT * FROM answer_pages WHERE file_id=? AND page_number=?", (data.id, data.page_number)).fetchone()
    if cached:
        return check_owned_export(dict(cached), "答卷页面")
    content, (width, height) = _render(file, data.page_number)
    path, digest = store_bytes(content, ".png")
    conn.execute("INSERT INTO answer_pages VALUES(?,?,?,?,?,?) ON CONFLICT(file_id,page_number) DO NOTHING", (data.id, data.page_number, str(path), digest, width, height))
    return check_owned_export(dict(conn.execute("SELECT * FROM answer_pages WHERE file_id=? AND page_number=?", (data.id, data.page_number)).fetchone()), "答卷页面")


def preview(conn, data, actor):
    from PIL import Image

    page = get_page(conn, data, actor)
    with Image.open(page["stored_path"]) as image:
        image.thumbnail((1400, 1400))
        output = BytesIO()
        image.save(output, format="PNG")
    return {"mime_type": "image/png", "content_base64": base64.b64encode(output.getvalue()).decode("ascii"),
            "page_number": data.page_number, "source_sha256": page["sha256"], "width": page["width"], "height": page["height"]}
