"""Textbook versions, deterministic extraction and verifiable source retrieval."""

import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import re

from .database import audit, encode, new_id
from .files import store_bytes, upload_path
from .models import DomainError
from .parsers import PARSERS, parse_book
from .records import get_record, require_active


def _filename(name):
    if "/" in name or "\\" in name or "\x00" in name or Path(name).suffix.lower() not in PARSERS:
        raise DomainError("unsupported_format", "教材支持 PDF、DOCX、PPTX 和 TXT 文件")
    return Path(name).suffix.lower()


def get_book(conn, data):
    row = conn.execute("SELECT * FROM textbooks WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "教材不存在")
    book = dict(row)
    book["versions"] = []
    for version in conn.execute("SELECT * FROM textbook_versions WHERE textbook_id=? ORDER BY version DESC", (data.id,)):
        result = dict(version)
        result["metadata"] = json.loads(result.pop("metadata_json"))
        book["versions"].append(result)
    return book


def list_books(conn, data):
    from .models import Identifier

    get_record(conn, "course", data.course_id)
    rows = conn.execute("SELECT id FROM textbooks WHERE course_id=? ORDER BY created_at,id", (data.course_id,)).fetchall()
    return {"items": [get_book(conn, Identifier(id=row[0])) for row in rows]}


def _validate_book_course(conn, course_id, textbook_id):
    require_active(conn, "course", course_id)
    if textbook_id:
        row = conn.execute("SELECT course_id FROM textbooks WHERE id=?", (textbook_id,)).fetchone()
        if row is None or row[0] != course_id:
            raise DomainError("association_conflict", "教材与所选课程不一致")


def import_book(conn, data, actor):
    _validate_book_course(conn, data.course_id, data.textbook_id)
    source = Path(data.path).expanduser()
    if not source.is_absolute() or not source.is_file():
        raise DomainError("file_not_found", "请选择实际存在的教材绝对路径")
    if not 0 < source.stat().st_size <= 50 * 1024 * 1024:
        raise DomainError("invalid_file_size", "教材文件需大于0且不超过50MB")
    suffix = _filename(source.name)
    return _ingest(conn, data.course_id, data.textbook_id, data.title, source.name, source.read_bytes(), suffix, actor)


def _ingest(conn, course_id, textbook_id, title, filename, content, suffix, actor):
    from .models import Identifier

    digest = hashlib.sha256(content).hexdigest()
    if textbook_id:
        existing = conn.execute("SELECT id FROM textbook_versions WHERE textbook_id=? AND sha256=?", (textbook_id, digest)).fetchone()
    else:
        existing = conn.execute("""SELECT v.id FROM textbook_versions v JOIN textbooks b ON b.id=v.textbook_id
            WHERE b.course_id=? AND v.sha256=? LIMIT 1""", (course_id, digest)).fetchone()
    if existing:
        return get_version(conn, Identifier(id=existing[0]))
    stored, digest = store_bytes(content, suffix)
    parsed = parse_book(stored, suffix)
    if textbook_id is None:
        textbook_id = new_id()
        conn.execute("INSERT INTO textbooks(id,course_id,title) VALUES(?,?,?)", (textbook_id, course_id, title))
    version_id = new_id()
    number = conn.execute("SELECT COALESCE(MAX(version),0)+1 FROM textbook_versions WHERE textbook_id=?", (textbook_id,)).fetchone()[0]
    metadata = {"warnings": parsed.warnings, "toc": parsed.toc, "source_unit_count": len(parsed.units),
                "parser": suffix.removeprefix("."), "chapter_detection": "rules", "knowledge_extraction": "source_candidates"}
    conn.execute("INSERT INTO textbook_versions(id,textbook_id,version,sha256,filename,stored_path,byte_size,metadata_json) VALUES(?,?,?,?,?,?,?,?)",
                 (version_id, textbook_id, number, digest, filename, str(stored), len(content), encode(metadata)))
    _index_units(conn, version_id, parsed.units)
    result = get_version(conn, Identifier(id=version_id))
    audit(conn, "textbook", textbook_id, "import_version", actor, None, result)
    return result


def _index_units(conn, version_id, units):
    ancestors = []
    chapter = None
    chapter_ordinal = 0
    for ordinal, unit in enumerate(units, 1):
        if unit.heading_level:
            while ancestors and ancestors[-1][0] >= unit.heading_level:
                ancestors.pop()
            chapter = new_id()
            chapter_ordinal += 1
            parent = ancestors[-1][1] if ancestors else None
            conn.execute("INSERT INTO chapters VALUES(?,?,?,?,?,?)", (chapter, version_id, parent, chapter_ordinal, unit.heading_level, unit.text[:200]))
            ancestors.append((unit.heading_level, chapter))
        source_id = new_id()
        conn.execute("INSERT INTO source_units VALUES(?,?,?,?,?,?,?,?)",
                     (source_id, version_id, chapter, ordinal, unit.kind, unit.page, unit.locator, unit.text))
        conn.execute("INSERT INTO source_fts(source_id,text) VALUES(?,?)", (source_id, unit.text))
        if not unit.heading_level and len(unit.text) >= 8:
            sentence = re.split(r"(?<=[。！？.!?])\s*", unit.text, maxsplit=1)[0]
            conn.execute("INSERT INTO knowledge_points(id,version_id,chapter_id,source_id,title,text,method) VALUES(?,?,?,?,?,?,?)",
                         (new_id(), version_id, chapter, source_id, sentence[:100], unit.text, "source_candidate"))


def get_version(conn, data):
    row = conn.execute("SELECT * FROM textbook_versions WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "教材版本不存在")
    result = dict(row)
    result["metadata"] = json.loads(result.pop("metadata_json"))
    result["chapters"] = [dict(row) for row in conn.execute("SELECT * FROM chapters WHERE version_id=? ORDER BY ordinal", (data.id,))]
    result["knowledge_point_count"] = conn.execute("SELECT COUNT(*) FROM knowledge_points WHERE version_id=?", (data.id,)).fetchone()[0]
    return result


def get_source(conn, data):
    row = conn.execute("""SELECT s.*,v.textbook_id,v.filename,v.sha256,v.version,b.title AS textbook_title,b.course_id
        FROM source_units s JOIN textbook_versions v ON v.id=s.version_id JOIN textbooks b ON b.id=v.textbook_id
        WHERE s.id=?""", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "教材来源不存在")
    return dict(row)


def list_sources(conn, data):
    from .models import Identifier

    get_version(conn, Identifier(id=data.version_id))
    rows = conn.execute("SELECT id FROM source_units WHERE version_id=? ORDER BY ordinal LIMIT ? OFFSET ?", (data.version_id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM source_units WHERE version_id=?", (data.version_id,)).fetchone()[0]
    return {"items": [get_source(conn, Identifier(id=row[0])) for row in rows], "total": total, "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def list_knowledge(conn, data):
    from .models import Identifier

    get_version(conn, Identifier(id=data.version_id))
    rows = conn.execute("SELECT * FROM knowledge_points WHERE version_id=? ORDER BY rowid LIMIT ? OFFSET ?", (data.version_id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM knowledge_points WHERE version_id=?", (data.version_id,)).fetchone()[0]
    return {"items": [dict(row) for row in rows], "total": total, "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def search_sources(conn, data):
    from .models import Identifier

    terms = data.query.split()
    fts = " AND ".join('"' + term.replace('"', '""') + '"' for term in terms)
    get_record(conn, "course", data.course_id)
    scope = """b.course_id=? AND (? IS NULL OR s.version_id=?)
        AND (? IS NOT NULL OR v.version=(SELECT MAX(v2.version) FROM textbook_versions v2 WHERE v2.textbook_id=v.textbook_id))
        AND (? IS NULL OR s.chapter_id IN (WITH RECURSIVE children(id) AS (
            SELECT id FROM chapters WHERE id=? UNION ALL SELECT c.id FROM chapters c JOIN children ON c.parent_id=children.id
        ) SELECT id FROM children))"""
    params = (data.course_id, data.version_id, data.version_id, data.version_id, data.chapter_id, data.chapter_id)
    joins = "JOIN textbook_versions v ON v.id=s.version_id JOIN textbooks b ON b.id=v.textbook_id"
    if all(len(term) >= 3 for term in terms):
        rows = conn.execute(f"""SELECT s.id FROM source_fts JOIN source_units s ON s.id=source_fts.source_id {joins}
            WHERE source_fts MATCH ? AND {scope} ORDER BY bm25(source_fts),s.ordinal LIMIT ?""", (fts, *params, data.limit)).fetchall()
    else:
        predicates = " AND ".join("s.text LIKE ? ESCAPE '\\'" for _ in terms)
        patterns = ["%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%" for term in terms]
        rows = conn.execute(f"SELECT s.id FROM source_units s {joins} WHERE {scope} AND {predicates} ORDER BY v.version DESC,s.ordinal LIMIT ?",
                            (*params, *patterns, data.limit)).fetchall()
    return {"items": [get_source(conn, Identifier(id=row[0])) for row in rows], "mode": "full_text"}


def begin_upload(conn, data, actor):
    _filename(data.filename)
    _validate_book_course(conn, data.course_id, data.textbook_id)
    identifier = new_id()
    with upload_path(identifier).open("xb"):
        pass
    conn.execute("INSERT INTO textbook_uploads(id,course_id,textbook_id,title,filename,total_bytes,sha256) VALUES(?,?,?,?,?,?,?)",
                 (identifier, data.course_id, data.textbook_id, data.title, data.filename, data.total_bytes, data.sha256))
    return {"id": identifier, "bytes_received": 0}


def _upload(conn, identifier):
    row = conn.execute("SELECT * FROM textbook_uploads WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise DomainError("not_found", "上传任务不存在")
    return row


def upload_chunk(conn, data, actor):
    row = _upload(conn, data.id)
    if row["status"] != "uploading":
        raise DomainError("invalid_transition", "上传已结束")
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise DomainError("invalid_input", "上传内容不是有效Base64") from None
    if not 0 < len(content) <= 512 * 1024 or data.offset + len(content) > row["total_bytes"]:
        raise DomainError("invalid_file_size", "上传分块大小不正确")
    path = upload_path(row["id"])
    with path.open("r+b") as stream:
        if path.stat().st_size < row["bytes_received"] or data.offset > row["bytes_received"]:
            raise DomainError("upload_conflict", "上传偏移与已保存数据不一致")
        stream.seek(data.offset)
        if data.offset < row["bytes_received"]:
            if data.offset + len(content) > row["bytes_received"] or stream.read(len(content)) != content:
                raise DomainError("upload_conflict", "重复分块的内容不一致")
            return {"id": row["id"], "bytes_received": row["bytes_received"]}
        stream.write(content)
        stream.truncate()
        stream.flush()
        os.fsync(stream.fileno())
    received = row["bytes_received"] + len(content)
    conn.execute("UPDATE textbook_uploads SET bytes_received=? WHERE id=?", (received, row["id"]))
    return {"id": row["id"], "bytes_received": received}


def finish_upload(conn, data, actor):
    row = _upload(conn, data.id)
    if row["result_json"]:
        return json.loads(row["result_json"])
    content = upload_path(row["id"]).read_bytes()
    if len(content) != row["total_bytes"] or row["bytes_received"] != len(content):
        raise DomainError("incomplete_upload", "教材尚未上传完整")
    if hashlib.sha256(content).hexdigest() != row["sha256"]:
        raise DomainError("file_integrity_error", "上传文件哈希不一致")
    _validate_book_course(conn, row["course_id"], row["textbook_id"])
    result = _ingest(conn, row["course_id"], row["textbook_id"], row["title"], row["filename"], content, _filename(row["filename"]), actor)
    conn.execute("UPDATE textbook_uploads SET status='ready',result_json=? WHERE id=?", (encode(result), row["id"]))
    return result


def rename_chapter(conn, data, actor):
    before = conn.execute("SELECT * FROM chapters WHERE id=?", (data.id,)).fetchone()
    if before is None:
        raise DomainError("not_found", "章节不存在")
    conn.execute("UPDATE chapters SET title=? WHERE id=?", (data.title, data.id))
    after = {**dict(before), "title": data.title}
    audit(conn, "chapter", data.id, "rename", actor, dict(before), after)
    return after


def review_knowledge(conn, data, actor):
    before = conn.execute("SELECT * FROM knowledge_points WHERE id=?", (data.id,)).fetchone()
    if before is None:
        raise DomainError("not_found", "知识点不存在")
    conn.execute("UPDATE knowledge_points SET title=?,review_status='reviewed' WHERE id=?", (data.title, data.id))
    after = {**dict(before), "title": data.title, "review_status": "reviewed"}
    audit(conn, "knowledge_point", data.id, "review", actor, dict(before), after)
    return after
