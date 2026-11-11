"""Teacher-owned homework, exam, preparation and personal deadlines."""

from .database import audit, new_id
from .models import DomainError, Identifier
from .records import require_active


def get_todo(conn, data):
    row = conn.execute("SELECT * FROM teacher_todos WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "教师待办不存在")
    return dict(row)


def list_todos(conn, data):
    rows = conn.execute("SELECT * FROM teacher_todos WHERE (? IS NULL OR status=?) ORDER BY due_at,id LIMIT ? OFFSET ?",
                        (data.status, data.status, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM teacher_todos WHERE (? IS NULL OR status=?)", (data.status, data.status)).fetchone()[0]
    return {"items": [dict(row) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def create(conn, data, actor):
    if data.course_id:
        require_active(conn, "course", data.course_id)
    identifier = new_id()
    conn.execute("INSERT INTO teacher_todos(id,title,details,kind,course_id,due_at,lead_minutes) VALUES(?,?,?,?,?,?,?)",
        (identifier, data.title, data.details, data.kind, data.course_id, data.due_at.isoformat(timespec="seconds"), data.lead_minutes))
    result = get_todo(conn, Identifier(id=identifier))
    audit(conn, "teacher_todo", identifier, "create", actor, None, result)
    return result


def update(conn, data, actor):
    before = get_todo(conn, data)
    if before["version"] != data.version:
        raise DomainError("version_conflict", "待办已有新版本，请刷新后修改")
    if data.course_id:
        require_active(conn, "course", data.course_id)
    conn.execute("""UPDATE teacher_todos SET title=?,details=?,kind=?,course_id=?,due_at=?,lead_minutes=?,status=?,
        version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?""",
        (data.title, data.details, data.kind, data.course_id, data.due_at.isoformat(timespec="seconds"), data.lead_minutes, data.status, data.id))
    result = get_todo(conn, data)
    audit(conn, "teacher_todo", data.id, "update", actor, before, result)
    return result
