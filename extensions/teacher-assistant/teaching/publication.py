"""Atomic plan publication carries compatible teacher edits instead of silently replacing them."""

from .database import audit, encode, new_id
from .models import DomainError, Identifier
from .planning import get_plan
from .records import require_active
from .timetable import check_conflict, get_event, get_publication


def _key(session):
    return session["starts_at"], session["ends_at"], session["kind"], session["chapter_id"]


def _candidates(conn, plan, previous):
    existing = {}
    if previous:
        rows = conn.execute("""SELECT m.event_id,s.* FROM timetable_members m JOIN planned_sessions s ON s.id=m.planned_session_id
            WHERE m.publication_id=?""", (previous["id"],)).fetchall()
        existing = {_key(row): get_event(conn, Identifier(id=row["event_id"])) for row in rows}
    new_keys = {_key(session) for session in plan["sessions"]}
    if any(event["version"] > 1 and key not in new_keys for key, event in existing.items()):
        raise DomainError("publication_has_changes", "旧课表有调课或进度记录无法对应新计划，请先核对并调整计划日期与章节，原记录已保留")
    result = []
    for session in plan["sessions"]:
        event = existing.get(_key(session))
        result.append({"session": session, "event": event,
                       "starts_at": event["starts_at"] if event else session["starts_at"],
                       "ends_at": event["ends_at"] if event else session["ends_at"],
                       "status": event["status"] if event else "scheduled"})
    return result


def _check_candidates(conn, candidates, previous):
    occupied = sorted((item for item in candidates if item["status"] != "cancelled"), key=lambda item: item["starts_at"])
    previous_end = None
    for item in occupied:
        if previous_end is not None and item["starts_at"] < previous_end:
            raise DomainError("calendar_conflict", "保留原调课记录后新课表发生重叠，请先调整计划")
        previous_end = item["ends_at"]
        check_conflict(conn, item["starts_at"], item["ends_at"], ignore_publication=previous["id"] if previous else None)


def publish(conn, data, actor):
    plan = get_plan(conn, data)
    published = conn.execute("SELECT * FROM timetable_publications WHERE plan_id=?", (data.id,)).fetchone()
    if published:
        if not published["active"]:
            raise DomainError("publication_inactive", "该计划已归档，请从当前计划生成新版本后发布")
        return get_publication(conn, Identifier(id=published["id"]))
    require_active(conn, "course", plan["course_id"])
    latest = conn.execute("SELECT MAX(version) FROM semester_plans WHERE root_id=?", (plan["root_id"],)).fetchone()[0]
    if plan["version"] != latest:
        raise DomainError("version_conflict", "请发布最新的计划版本")
    previous = conn.execute("SELECT * FROM timetable_publications WHERE root_id=? AND active=1", (plan["root_id"],)).fetchone()
    if data.replaces_publication_id != (previous["id"] if previous else None):
        raise DomainError("publication_conflict", "当前发布版本已变化，请刷新并确认替换范围")
    candidates = _candidates(conn, plan, previous)
    _check_candidates(conn, candidates, previous)
    if previous:
        old = get_publication(conn, Identifier(id=previous["id"]))
        snapshot = encode({"events": old["events"], "progress": old["progress"]})
        conn.execute("UPDATE timetable_publications SET active=0,snapshot_json=?,retired_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (snapshot, previous["id"]))
    identifier = new_id()
    conn.execute("INSERT INTO timetable_publications(id,plan_id,root_id,review_note,published_by) VALUES(?,?,?,?,?)",
                 (identifier, data.id, plan["root_id"], data.review_note, actor))
    for item in candidates:
        session, event = item["session"], item["event"]
        event_id = event["id"] if event else new_id()
        if event is None:
            conn.execute("INSERT INTO timetable_events(id,source_session_id,starts_at,ends_at,timing_json) VALUES(?,?,?,?,?)",
                         (event_id, session["id"], session["starts_at"], session["ends_at"], encode(session["periods"])))
        conn.execute("INSERT INTO timetable_members VALUES(?,?,?)", (identifier, session["id"], event_id))
    result = get_publication(conn, Identifier(id=identifier))
    audit(conn, "timetable_publication", identifier, "publish", actor, dict(previous) if previous else None, result)
    return result
