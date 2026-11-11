"""Durable teaching-task state. Hermes remains the execution and agent runtime."""

import json

from .database import audit, encode, new_id
from .models import CourseCreate, DomainError
from .records import create_record


def get_task(conn, identifier):
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise DomainError("not_found", "任务不存在")
    task = dict(row)
    for key in ("input", "result"):
        raw = task.pop(key + "_json")
        task[key] = json.loads(raw) if raw else None
    approval = conn.execute("SELECT * FROM approvals WHERE workflow_id=?", (identifier,)).fetchone()
    task["approval"] = dict(approval) if approval else None
    task["steps"] = [dict(row) for row in conn.execute(
        "SELECT step_key,completed_at FROM workflow_steps WHERE workflow_id=? ORDER BY completed_at,step_key", (identifier,))]
    return task


def list_tasks(conn):
    rows = conn.execute("SELECT id FROM workflows ORDER BY created_at DESC,id").fetchall()
    return {"items": [get_task(conn, row[0]) for row in rows]}


def create_task(conn, data, actor):
    identifier = new_id()
    conn.execute("INSERT INTO workflows(id,kind,status,input_json) VALUES(?,?,'pending',?)",
                 (identifier, data.kind, encode(data.course.model_dump())))
    task = get_task(conn, identifier)
    audit(conn, "workflow", identifier, "create", actor, None, task)
    return task


def change_task(conn, data, actor, target):
    before = get_task(conn, data.id)
    if before["version"] != data.version:
        raise DomainError("version_conflict", "任务已更新，请刷新后重试")
    allowed = {"pending": {"failed"}, "cancelled": {"pending", "awaiting_review", "failed"}}
    if target == "cancelled" and before["kind"] in {"document_generation", "exam_generation"}:
        allowed[target].add("running")
    if before["status"] not in allowed[target]:
        raise DomainError("invalid_transition", "当前任务状态不允许此操作")
    conn.execute("UPDATE workflows SET status=?,error=NULL,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                 (target, data.id))
    if target == "cancelled":
        conn.execute("UPDATE approvals SET status='cancelled' WHERE workflow_id=? AND status='pending'", (data.id,))
    after = get_task(conn, data.id)
    audit(conn, "workflow", data.id, target, actor, before, after)
    return after


def run_task(conn, data, actor):
    before = get_task(conn, data.id)
    if before["status"] in {"awaiting_review", "completed"}:
        return before
    if before["status"] != "pending":
        raise DomainError("invalid_transition", "仅待执行任务可运行，失败任务需要先重试")
    if before["kind"] != "course_setup":
        raise DomainError("unsupported_workflow", "该任务类型尚未注册")
    conn.execute("UPDATE workflows SET status='running' WHERE id=?", (data.id,))
    conn.execute("SAVEPOINT teaching_step")
    try:
        result = create_record(conn, "course", CourseCreate.model_validate(before["input"]), actor)
        conn.execute("INSERT INTO workflow_steps(workflow_id,step_key,result_json) VALUES(?,'course.create',?)",
                     (data.id, encode(result)))
        conn.execute("UPDATE workflows SET status='awaiting_review',result_json=?,version=version+1 WHERE id=?",
                     (encode(result), data.id))
        conn.execute("INSERT INTO approvals(id,workflow_id,workflow_version) VALUES(?,?,?)",
                     (new_id(), data.id, before["version"] + 1))
        conn.execute("RELEASE teaching_step")
    except ValueError as exc:
        conn.execute("ROLLBACK TO teaching_step")
        conn.execute("RELEASE teaching_step")
        conn.execute("UPDATE workflows SET status='failed',error=?,version=version+1 WHERE id=?", (str(exc), data.id))
    after = get_task(conn, data.id)
    audit(conn, "workflow", data.id, "run", actor, before, after)
    return after


def review_task(conn, data, actor):
    before = get_task(conn, data.id)
    if before["kind"] != "course_setup":
        raise DomainError("review_required", "教学文档请在备课页面审核对应的完整正文版本")
    if before["status"] != "awaiting_review" or before["version"] != data.version:
        raise DomainError("version_conflict", "审核对象已变化，请刷新后审核")
    from .records import get_record
    current = get_record(conn, "course", before["result"]["id"])
    if current["version"] != before["result"]["version"]:
        raise DomainError("version_conflict", "课程内容在任务执行后已修改，请重新核查")
    status = "completed" if data.decision == "approved" else "cancelled"
    conn.execute("UPDATE approvals SET status=?,note=?,reviewed_by=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE workflow_id=? AND status='pending'",
                 (data.decision, data.note, actor, data.id))
    conn.execute("UPDATE workflows SET status=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                 (status, data.id))
    after = get_task(conn, data.id)
    audit(conn, "workflow", data.id, "review", actor, before, after)
    return after
