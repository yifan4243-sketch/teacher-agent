"""The active teacher calendar and audited moves/progress share one transaction boundary."""

from datetime import datetime, time, timedelta
import json
from zoneinfo import ZoneInfo

from .database import audit, encode
from .lessons import get_lesson
from .models import DomainError, Identifier


def get_event(conn, data):
    row = conn.execute("""SELECT e.*,s.plan_id AS source_plan_id,s.ordinal AS source_ordinal,s.kind,s.title,s.chapter_id,
        s.instruction_minutes,s.assessment_minutes,p.course_id,p.textbook_version_id,c.title AS course_title
        FROM timetable_events e JOIN planned_sessions s ON s.id=e.source_session_id
        JOIN semester_plans p ON p.id=s.plan_id JOIN courses c ON c.id=p.course_id WHERE e.id=?""", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "课表课次不存在")
    result = dict(row)
    result["periods"] = json.loads(result.pop("timing_json"))
    publication = conn.execute("""SELECT p.id,s.ordinal,s.title FROM timetable_publications p JOIN timetable_members m ON m.publication_id=p.id
        JOIN planned_sessions s ON s.id=m.planned_session_id
        WHERE p.active=1 AND m.event_id=?""", (data.id,)).fetchone()
    result["active_publication_id"] = publication[0] if publication else None
    result["ordinal"] = publication[1] if publication else result["source_ordinal"]
    result["source_title"] = result["title"]
    if publication:
        result["title"] = publication[2]
    return result


def get_publication(conn, data):
    row = conn.execute("SELECT * FROM timetable_publications WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "课表发布记录不存在")
    result = dict(row)
    snapshot = json.loads(result.pop("snapshot_json") or "null")
    if not result["active"] and snapshot:
        return {**result, **snapshot}
    members = conn.execute("""SELECT m.event_id,s.ordinal FROM timetable_members m JOIN planned_sessions s ON s.id=m.planned_session_id
        WHERE m.publication_id=? ORDER BY s.ordinal""", (data.id,)).fetchall()
    result["events"] = [{**get_event(conn, Identifier(id=row[0])), "plan_ordinal": row[1]} for row in members]
    result["progress"] = progress_totals(result["events"])
    return result


def progress_totals(events):
    completed = [event for event in events if event["status"] == "completed"]
    actual = sum(event["actual_minutes"] for event in completed if event["kind"] != "exam")
    expected = sum(event["instruction_minutes"] for event in completed)
    now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None).isoformat(timespec="seconds")
    return {"total_sessions": len(events), "completed_sessions": len(completed),
            "cancelled_sessions": sum(event["status"] == "cancelled" for event in events),
            "overdue_sessions": sum(event["status"] == "scheduled" and event["ends_at"] < now for event in events),
            "actual_instruction_minutes": actual, "completed_planned_instruction_minutes": expected,
            "instruction_variance_minutes": actual - expected,
            "actual_assessment_minutes": sum(event["actual_minutes"] for event in completed if event["kind"] == "exam"),
            "remaining_instruction_minutes": sum(event["instruction_minutes"] for event in events if event["status"] == "scheduled"),
            "as_of": now, "time_basis": "Asia/Shanghai"}


def list_calendar(conn, data):
    start = datetime.combine(data.start_date, time.min).isoformat(timespec="seconds")
    end = datetime.combine(data.end_date + timedelta(days=1), time.min).isoformat(timespec="seconds")
    rows = conn.execute("""SELECT e.id FROM timetable_events e JOIN timetable_members m ON m.event_id=e.id
        JOIN timetable_publications p ON p.id=m.publication_id JOIN semester_plans s ON s.id=p.plan_id
        WHERE p.active=1 AND e.starts_at>=? AND e.starts_at<? AND (? IS NULL OR s.course_id=?)
        ORDER BY e.starts_at,e.id LIMIT 2001""", (start, end, data.course_id, data.course_id)).fetchall()
    if len(rows) > 2000:
        raise DomainError("range_too_large", "该范围超过2000个课次，请缩短查询日期")
    events = [get_event(conn, Identifier(id=row[0])) for row in rows]
    return {"items": events, "progress": progress_totals(events)}


def check_conflict(conn, start, end, *, ignore_publication=None, ignore_event=None):
    row = conn.execute("""SELECT e.id,s.title FROM timetable_events e JOIN timetable_members m ON m.event_id=e.id
        JOIN timetable_publications p ON p.id=m.publication_id JOIN planned_sessions s ON s.id=e.source_session_id
        WHERE p.active=1 AND e.status!='cancelled' AND e.starts_at<? AND e.ends_at>?
        AND (? IS NULL OR p.id!=?) AND (? IS NULL OR e.id!=?) LIMIT 1""",
        (end, start, ignore_publication, ignore_publication, ignore_event, ignore_event)).fetchone()
    if row:
        raise DomainError("calendar_conflict", f"与已发布课次“{row['title']}”重叠，请先调整时段")


def _editable(conn, data):
    event = get_event(conn, data)
    if not event["active_publication_id"]:
        raise DomainError("publication_inactive", "请在当前已发布课表中修改，历史课表保持归档")
    if event["active_publication_id"] != data.publication_id:
        raise DomainError("publication_conflict", "该课次所属发布版本已变化，请刷新当前课表")
    if event["version"] != data.version:
        raise DomainError("version_conflict", "课表课次已有新版本，请刷新后修改")
    return event


def move(conn, data, actor):
    before = _editable(conn, data)
    if before["status"] != "scheduled":
        raise DomainError("invalid_transition", "调课需先将课次更正为待授课状态")
    delta = data.starts_at - datetime.fromisoformat(before["starts_at"])
    end = datetime.fromisoformat(before["ends_at"]) + delta
    if end.date() != data.starts_at.date():
        raise DomainError("schedule_conflict", "调课后不能跨越午夜")
    start_text, end_text = data.starts_at.isoformat(timespec="seconds"), end.isoformat(timespec="seconds")
    check_conflict(conn, start_text, end_text, ignore_event=data.id)
    periods = [{"kind": part["kind"], "start": (datetime.fromisoformat(part["start"]) + delta).isoformat(timespec="seconds"),
                "end": (datetime.fromisoformat(part["end"]) + delta).isoformat(timespec="seconds")} for part in before["periods"]]
    conn.execute("""UPDATE timetable_events SET starts_at=?,ends_at=?,timing_json=?,note=?,version=version+1,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?""", (start_text, end_text, encode(periods), data.note, data.id))
    result = get_event(conn, data)
    audit(conn, "calendar_event", data.id, "reschedule", actor, before, result)
    return result


def record_progress(conn, data, actor):
    before = _editable(conn, data)
    if data.status == "completed" and before["starts_at"] > datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None).isoformat(timespec="seconds"):
        raise DomainError("future_progress", "未来尚未开始的课次不能登记为已完成")
    if data.status != "cancelled":
        check_conflict(conn, before["starts_at"], before["ends_at"], ignore_event=data.id)
    maximum = before["assessment_minutes"] if before["kind"] == "exam" else before["instruction_minutes"]
    if data.actual_minutes is not None and data.actual_minutes > maximum:
        raise DomainError("invalid_minutes", "实际分钟不能超过本课次安排的教学或考核分钟，请核对课次和时间")
    if data.lesson_id:
        lesson = get_lesson(conn, Identifier(id=data.lesson_id))
        if lesson["course_id"] != before["course_id"] or lesson["version_id"] != before["textbook_version_id"]:
            raise DomainError("association_conflict", "关联备课课次需属于相同课程和教材版本")
    conn.execute("""UPDATE timetable_events SET status=?,actual_minutes=?,lesson_id=?,note=?,version=version+1,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?""", (data.status, data.actual_minutes, data.lesson_id, data.note, data.id))
    result = get_event(conn, data)
    audit(conn, "calendar_event", data.id, "record_progress", actor, before, result)
    return result


def history(conn, data):
    get_event(conn, data)
    rows = conn.execute("SELECT * FROM audit_events WHERE entity_type='calendar_event' AND entity_id=? ORDER BY sequence", (data.id,)).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item["before"] = json.loads(item.pop("before_json"))
        item["after"] = json.loads(item.pop("after_json"))
        items.append(item)
    return {"items": items}
