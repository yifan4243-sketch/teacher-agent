"""Versioned source-linked question bank exposed through the native assessment tool."""

import hashlib
import json
import unicodedata

from .database import audit, encode, new_id
from .knowledge import get_book, get_source, get_version
from .models import DomainError, Identifier
from .records import get_record, require_active


def get_question(conn, data):
    row = conn.execute("SELECT * FROM question_versions WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "题目版本不存在")
    result = dict(row)
    result["content"] = json.loads(result.pop("content_json"))
    result["latest_version"] = conn.execute("SELECT MAX(version) FROM question_versions WHERE root_id=?", (result["root_id"],)).fetchone()[0]
    result["sources"] = [get_source(conn, Identifier(id=source[0])) for source in conn.execute("SELECT source_id FROM question_sources WHERE question_id=? ORDER BY ordinal", (data.id,))]
    result["duplicates"] = [dict(item) for item in conn.execute("""SELECT q.id,q.root_id,q.version,q.status FROM question_versions q
        WHERE q.course_id=? AND q.textbook_version_id=? AND q.prompt_hash=? AND q.root_id<>?
        AND q.version=(SELECT MAX(version) FROM question_versions WHERE root_id=q.root_id AND textbook_version_id=q.textbook_version_id) ORDER BY q.id""",
        (result["course_id"], result["textbook_version_id"], result["prompt_hash"], result["root_id"]))]
    return result


def list_questions(conn, data):
    get_record(conn, "course", data.course_id)
    search = "%" + data.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    where = """q.course_id=? AND (? IS NULL OR q.textbook_version_id=?) AND (? IS NULL OR q.kind=?)
        AND (? IS NULL OR q.difficulty=?) AND (? IS NULL OR q.status=?) AND q.prompt LIKE ? ESCAPE '\\'
        AND (? IS NULL OR EXISTS (SELECT 1 FROM question_sources qs JOIN source_units s ON s.id=qs.source_id
            WHERE qs.question_id=q.id AND s.chapter_id IN (WITH RECURSIVE children(id) AS (
                SELECT id FROM chapters WHERE id=? UNION ALL SELECT c.id FROM chapters c JOIN children ON c.parent_id=children.id
            ) SELECT id FROM children)))
        AND ((? IS NOT NULL AND q.root_id=?) OR (? IS NULL AND q.version=(SELECT MAX(version) FROM question_versions WHERE root_id=q.root_id
            AND (? IS NULL OR status=?) AND (? IS NULL OR textbook_version_id=?))))"""
    parameters = (data.course_id, data.textbook_version_id, data.textbook_version_id, data.kind, data.kind,
        data.difficulty, data.difficulty, data.status, data.status, search, data.chapter_id, data.chapter_id,
        data.root_id, data.root_id, data.root_id, data.status, data.status, data.textbook_version_id, data.textbook_version_id)
    rows = conn.execute(f"SELECT q.* FROM question_versions q WHERE {where} ORDER BY q.created_at DESC,q.id DESC LIMIT ? OFFSET ?", (*parameters, data.limit, data.offset)).fetchall()
    total = conn.execute(f"SELECT COUNT(*) FROM question_versions q WHERE {where}", parameters).fetchone()[0]
    items = []
    for row in rows:
        item = dict(row)
        item.pop("content_json")
        items.append(item)
    return {"items": items, "total": total, "next_offset": data.offset + len(items) if data.offset + len(items) < total else None}


def _validate_sources(conn, data):
    version = get_version(conn, Identifier(id=data.textbook_version_id))
    if get_book(conn, Identifier(id=version["textbook_id"]))["course_id"] != data.course_id:
        raise DomainError("association_conflict", "题目教材版本需属于所选课程")
    for source_id in data.content.source_ids:
        source = get_source(conn, Identifier(id=source_id))
        if source["version_id"] != data.textbook_version_id:
            raise DomainError("association_conflict", "题目来源需来自所选教材版本")
    for point_id in data.content.knowledge_point_ids:
        point = conn.execute("SELECT version_id,source_id FROM knowledge_points WHERE id=?", (point_id,)).fetchone()
        if point is None or point["version_id"] != data.textbook_version_id or point["source_id"] not in data.content.source_ids:
            raise DomainError("association_conflict", "题目知识点需来自所选教材及题目引用的原文来源")


def save_question(conn, data, actor):
    require_active(conn, "course", data.course_id)
    _validate_sources(conn, data)
    previous = None
    if data.root_id:
        previous = conn.execute("SELECT id FROM question_versions WHERE root_id=? ORDER BY version DESC LIMIT 1", (data.root_id,)).fetchone()
        if previous is None:
            raise DomainError("not_found", "待修订题目不存在")
        previous = get_question(conn, Identifier(id=previous["id"]))
        if previous["course_id"] != data.course_id:
            raise DomainError("association_conflict", "题目修订需属于同一课程，引用需对应各自教材版本")
    if data.expected_version != (previous["version"] if previous else 0):
        raise DomainError("version_conflict", "题目已有新版本，请刷新后修订")
    identifier = new_id()
    prompt = "".join(unicodedata.normalize("NFKC", data.content.prompt).casefold().split())
    digest = hashlib.sha256(prompt.encode()).hexdigest()
    conn.execute("""INSERT INTO question_versions(id,root_id,parent_id,version,course_id,textbook_version_id,kind,difficulty,
        points_centi,prompt,prompt_hash,content_json,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (identifier, previous["root_id"] if previous else identifier, previous["id"] if previous else None,
        data.expected_version + 1, data.course_id, data.textbook_version_id, data.content.kind, data.content.difficulty,
        data.content.points_centi, data.content.prompt, digest, encode(data.content.model_dump(mode="json")), actor))
    conn.executemany("INSERT INTO question_sources VALUES(?,?,?)", [(identifier, source, ordinal) for ordinal, source in enumerate(data.content.source_ids, 1)])
    conn.executemany("INSERT INTO question_knowledge VALUES(?,?)", [(identifier, point) for point in data.content.knowledge_point_ids])
    result = get_question(conn, Identifier(id=identifier))
    audit(conn, "question", identifier, "save_version", actor, previous, result)
    return result


def review_question(conn, data, actor):
    before = get_question(conn, data)
    if before["status"] != "draft":
        raise DomainError("invalid_transition", "已审核题目可以另存修订版后再审核")
    require_active(conn, "course", before["course_id"])
    conn.execute("UPDATE question_versions SET status=?,reviewed_by=?,review_note=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        (data.decision, actor, data.note, data.id))
    result = get_question(conn, data)
    audit(conn, "question", data.id, "review", actor, before, result)
    return result
