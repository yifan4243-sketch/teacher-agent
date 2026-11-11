"""Resolve an exam's source universe once and retain its progress evidence."""

from .knowledge import get_book, get_version
from .models import DomainError, Identifier


def _chapter_sources(conn, version_id, chapter_ids):
    sources = set()
    for chapter_id in chapter_ids:
        row = conn.execute("SELECT version_id FROM chapters WHERE id=?", (chapter_id,)).fetchone()
        if row is None or row[0] != version_id:
            raise DomainError("association_conflict", "命题章节需属于所选教材版本")
        sources.update(row[0] for row in conn.execute("""WITH RECURSIVE children(id) AS (
            SELECT id FROM chapters WHERE id=? UNION ALL SELECT c.id FROM chapters c JOIN children ON c.parent_id=children.id)
            SELECT id FROM source_units WHERE chapter_id IN (SELECT id FROM children) AND version_id=?""", (chapter_id, version_id)))
    return sources


def _progress(conn, course_id, version_id):
    events = conn.execute("""SELECT DISTINCT e.id,e.version,e.lesson_id,s.chapter_id FROM timetable_events e
        JOIN timetable_members m ON m.event_id=e.id JOIN timetable_publications pub ON pub.id=m.publication_id
        JOIN semester_plans p ON p.id=pub.plan_id JOIN planned_sessions s ON s.id=m.planned_session_id
        WHERE pub.active=1 AND p.course_id=? AND p.textbook_version_id=? AND e.status='completed'
        AND e.actual_minutes>0 AND s.kind!='exam'""", (course_id, version_id)).fetchall()
    sources = set()
    for event in events:
        if event["lesson_id"]:
            sources.update(row[0] for row in conn.execute("SELECT source_id FROM lesson_sources WHERE lesson_id=?", (event["lesson_id"],)))
        elif event["chapter_id"]:
            sources.update(_chapter_sources(conn, version_id, [event["chapter_id"]]))
    return sources, [dict(event) for event in events]


def resolve(conn, data):
    version = get_version(conn, Identifier(id=data.textbook_version_id))
    book = get_book(conn, Identifier(id=version["textbook_id"]))
    if book["course_id"] != data.course_id:
        raise DomainError("association_conflict", "命题教材需属于所选课程")
    config = data.config
    sources = {row[0] for row in conn.execute("SELECT id FROM source_units WHERE version_id=? AND trim(text)!=''", (data.textbook_version_id,))}
    if config.chapter_ids:
        sources &= _chapter_sources(conn, data.textbook_version_id, config.chapter_ids)
    progress = []
    if config.completed_only:
        completed, progress = _progress(conn, data.course_id, data.textbook_version_id)
        sources &= completed
    points = [dict(row) for row in conn.execute("SELECT id,source_id,title,review_status FROM knowledge_points WHERE version_id=? ORDER BY id", (data.textbook_version_id,)) if row["source_id"] in sources]
    if config.knowledge_point_ids:
        wanted = set(config.knowledge_point_ids)
        if not wanted <= {point["id"] for point in points}:
            raise DomainError("association_conflict", "指定知识点需属于教材、章节及已授范围的交集")
        points = [point for point in points if point["id"] in wanted]
        sources &= {point["source_id"] for point in points}
    if not sources:
        raise DomainError("empty_scope", "当前命题范围没有可用教材原文，请检查章节或已授进度")
    if config.coverage_percent and not points:
        raise DomainError("empty_knowledge_scope", "请先提取或选择知识点，再配置知识点覆盖比例")
    return {"source_ids": sorted(sources), "knowledge_points": points, "progress_events": progress,
            "textbook_title": book["title"], "textbook_sha256": version["sha256"], "textbook_version": version["version"]}
