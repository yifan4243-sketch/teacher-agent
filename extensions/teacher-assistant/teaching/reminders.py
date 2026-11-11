"""Derive reminders from current calendar/todo state and preserve every dispatch attempt."""

from datetime import datetime, timedelta
import hashlib
import json
import logging
from zoneinfo import ZoneInfo

from .database import audit, database, encode, new_id
from .models import DomainError, Identifier
from . import preparation_status, windows_notifications


KINDS = {"preclass": "课前提醒", "preparation": "备课提醒", "exam": "考试提醒", "homework": "作业提醒", "personal": "个人待办", "class_break": "课间提醒", "class_end": "下课提醒"}
logger = logging.getLogger(__name__)


def local_now():
    return datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)


def settings(conn, data=None):
    result = dict(conn.execute("SELECT * FROM reminder_settings WHERE id=1").fetchone())
    result["enabled"] = bool(result["enabled"])
    return result


def save_settings(conn, data, actor):
    before = settings(conn)
    if before["version"] != data.version:
        raise DomainError("version_conflict", "提醒设置已有更新，请刷新后保存")
    conn.execute("""UPDATE reminder_settings SET enabled=?,preclass_minutes=?,preparation_minutes=?,exam_minutes=?,late_grace_minutes=?,
        break_lead_minutes=?,end_lead_minutes=?,version=version+1 WHERE id=1""", (data.enabled, data.preclass_minutes,
        data.preparation_minutes, data.exam_minutes, data.late_grace_minutes, data.break_lead_minutes, data.end_lead_minutes))
    result = settings(conn)
    audit(conn, "reminder_settings", "1", "update", actor, before, result)
    return result


def _entry(source, kind, starts_at, lead, title, body, *, event_id=None, todo_id=None):
    due = datetime.fromisoformat(starts_at) - timedelta(minutes=lead)
    key = hashlib.sha256(encode([source, kind, starts_at, lead]).encode()).hexdigest()
    return {"occurrence_key": key, "event_id": event_id, "todo_id": todo_id, "kind": kind,
            "due_at": due.isoformat(timespec="seconds"), "title": title[:120], "body": body[:600]}


def wanted(conn, policy):
    result = {}
    events = conn.execute("""SELECT DISTINCT e.id,e.starts_at,e.ends_at,e.timing_json,e.lesson_id,s.kind,s.title,c.title AS course_title FROM timetable_events e
        JOIN timetable_members m ON m.event_id=e.id JOIN timetable_publications p ON p.id=m.publication_id
        JOIN planned_sessions s ON s.id=m.planned_session_id JOIN semester_plans t ON t.id=p.plan_id
        JOIN courses c ON c.id=t.course_id WHERE p.active=1 AND e.status='scheduled'""").fetchall()
    for event in events:
        options = [("exam", policy["exam_minutes"])] if event["kind"] == "exam" else [
            ("preclass", policy["preclass_minutes"]), ("preparation", policy["preparation_minutes"])]
        for kind, lead in options:
            if lead is None:
                continue
            body = f"{event['starts_at'].replace('T', ' ')}　{event['title']}"
            if kind == "preparation":
                body += "　" + preparation_status.summary(preparation_status.lesson_status(conn, event["lesson_id"]))
            item = _entry(event["id"], kind, event["starts_at"], lead, KINDS[kind] + " " + event["course_title"], body, event_id=event["id"])
            result[item["occurrence_key"]] = item
        boundaries = [("class_break", part["start"], policy["break_lead_minutes"]) for part in json.loads(event["timing_json"]) if part["kind"] == "break"]
        boundaries.append(("class_end", event["ends_at"], policy["end_lead_minutes"]))
        for kind, at, lead in boundaries:
            if lead is None:
                continue
            item = _entry(event["id"], kind, at, lead, KINDS[kind] + " " + event["course_title"],
                at.replace("T", " ") + "　" + event["title"], event_id=event["id"])
            result[item["occurrence_key"]] = item
    for todo in conn.execute("SELECT * FROM teacher_todos WHERE status='pending'"):
        item = _entry(todo["id"], todo["kind"], todo["due_at"], todo["lead_minutes"], KINDS[todo["kind"]] + " " + todo["title"],
            f"截止 {todo['due_at'].replace('T', ' ')}　{todo['details']}", todo_id=todo["id"])
        result[item["occurrence_key"]] = item
    return result


def reconcile(conn, now):
    policy = settings(conn)
    entries = wanted(conn, policy)
    grace = now - timedelta(minutes=policy["late_grace_minutes"])
    for key, item in entries.items():
        conn.execute("""INSERT OR IGNORE INTO reminder_deliveries(id,occurrence_key,event_id,todo_id,kind,due_at,title,body,state)
            VALUES(?,?,?,?,?,?,?,?, 'queued')""", (new_id(), key, item["event_id"], item["todo_id"], item["kind"], item["due_at"], item["title"], item["body"]))
        eligible = datetime.fromisoformat(item["due_at"]) >= grace
        conn.execute("""UPDATE reminder_deliveries SET title=?,body=?,state=CASE WHEN state IN ('cancelled','expired') AND ? THEN 'queued' ELSE state END,
            error_code=NULL WHERE occurrence_key=? AND state IN ('queued','cancelled','expired') AND parent_id IS NULL""", (item["title"], item["body"], eligible, key))
    queued = conn.execute("SELECT id,occurrence_key,due_at,parent_id FROM reminder_deliveries WHERE state='queued'").fetchall()
    for row in queued:
        source_key = row["occurrence_key"]
        if row["parent_id"]:
            source_key = conn.execute("SELECT occurrence_key FROM reminder_deliveries WHERE id=?", (row["parent_id"],)).fetchone()[0]
            if source_key in entries:
                current = entries[source_key]
                conn.execute("UPDATE reminder_deliveries SET title=?,body=? WHERE id=?", (current["title"], current["body"], row["id"]))
        state = "cancelled" if source_key not in entries else "expired" if datetime.fromisoformat(row["due_at"]) < grace else None
        if state:
            conn.execute("UPDATE reminder_deliveries SET state=?,finished_at=? WHERE id=?", (state, now.isoformat(timespec="seconds"), row["id"]))
    return policy


def get_delivery(conn, data):
    row = conn.execute("SELECT * FROM reminder_deliveries WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "提醒记录不存在")
    result = dict(row)
    result["receipt"] = json.loads(result.pop("receipt_json"))
    return result


def list_deliveries(conn, data):
    rows = conn.execute("SELECT id FROM reminder_deliveries ORDER BY due_at DESC,id DESC LIMIT ? OFFSET ?", (data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM reminder_deliveries").fetchone()[0]
    return {"items": [get_delivery(conn, Identifier(id=row[0])) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def refresh(conn, data, actor):
    reconcile(conn, local_now())
    return {"settings": settings(conn)}


def tick(*, now=None, limit=100):
    current = local_now() if now is None else now
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        policy = reconcile(conn, current)
        conn.execute("UPDATE reminder_settings SET last_tick_at=?,last_tick_error=NULL WHERE id=1", (current.isoformat(timespec="seconds"),))
        if not policy["enabled"]:
            return {"enabled": False, "accepted": 0, "failed": 0}
        rows = conn.execute("SELECT id FROM reminder_deliveries WHERE state='queued' AND due_at<=? ORDER BY due_at,id LIMIT ?",
                            (current.isoformat(timespec="seconds"), limit)).fetchall()
    accepted, failed, skipped = 0, 0, 0
    for row in rows:
        outcome = _dispatch(row[0], current)
        if outcome is None:
            skipped += 1
        elif outcome:
            accepted += 1
        else:
            failed += 1
    if failed:
        with database() as conn:
            conn.execute("UPDATE reminder_settings SET last_tick_error=? WHERE id=1", (f"{failed}条通知发送失败，请查看提醒记录",))
    return {"enabled": True, "accepted": accepted, "failed": failed, "skipped": skipped}


def _dispatch(identifier, now):
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        policy = reconcile(conn, now)
        item = get_delivery(conn, Identifier(id=identifier))
        if not policy["enabled"] or item["state"] != "queued":
            return None
        conn.execute("UPDATE reminder_deliveries SET state='dispatching',claimed_at=? WHERE id=?", (now.isoformat(timespec="seconds"), identifier))
    receipt, error = {}, None
    try:
        receipt = windows_notifications.notify(item["title"], item["body"], identifier)
    except DomainError as exc:
        error = exc.code
    except OSError:
        error = "notification_process_failed"
    except Exception:
        logger.exception("Windows reminder %s failed", identifier)
        error = "notification_unexpected_error"
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("UPDATE reminder_deliveries SET state=?,error_code=?,receipt_json=?,finished_at=? WHERE id=?",
            ("failed" if error else "accepted", error, encode(receipt), local_now().isoformat(timespec="seconds"), identifier))
        result = get_delivery(conn, Identifier(id=identifier))
        audit(conn, "reminder_delivery", identifier, "notify", "scheduler", item, result)
    return error is None


def retry(conn, data, actor):
    original = get_delivery(conn, data)
    root = get_delivery(conn, Identifier(id=original["parent_id"])) if original["parent_id"] else original
    current = wanted(conn, settings(conn)).get(root["occurrence_key"])
    if current is None:
        raise DomainError("reminder_source_changed", "相关课次或待办已更改，请刷新当前提醒")
    if original["state"] == "queued":
        return original
    if original["state"] not in {"failed", "dispatching"}:
        raise DomainError("reminder_retry_unavailable", "仅发送失败或发送中断的记录可以重试")
    queued = conn.execute("SELECT id FROM reminder_deliveries WHERE parent_id=? AND state='queued'", (root["id"],)).fetchone()
    if queued:
        return get_delivery(conn, Identifier(id=queued[0]))
    identifier = new_id()
    conn.execute("""INSERT INTO reminder_deliveries(id,occurrence_key,event_id,todo_id,kind,due_at,title,body,state,parent_id)
        VALUES(?,?,?,?,?,?,?,?, 'queued',?)""", (identifier, "retry:" + identifier, current["event_id"], current["todo_id"], current["kind"],
        local_now().isoformat(timespec="seconds"), current["title"], current["body"], root["id"]))
    result = get_delivery(conn, Identifier(id=identifier))
    audit(conn, "reminder_delivery", identifier, "retry_requested", actor, original, result)
    return result
