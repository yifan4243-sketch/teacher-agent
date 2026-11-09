"""Course and identity operations run inside the caller's single transaction."""

from .database import audit, new_id
from .models import CourseCreate, DomainError


TABLES = {"course": "courses", "class": "classes", "student": "students"}


def get_record(conn, entity, identifier):
    row = conn.execute(f"SELECT * FROM {TABLES[entity]} WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise DomainError("not_found", "记录不存在")
    result = dict(row)
    result["archived"] = bool(result["archived"])
    if entity == "course":
        result["instruction_minutes"] = result["period_minutes"] * result["period_count"]
        result["session_span_minutes"] = result["instruction_minutes"] + result["break_minutes"]
    return result


def require_active(conn, entity, identifier):
    row = get_record(conn, entity, identifier)
    if row["archived"]:
        raise DomainError("archived", "归档记录不能建立新的教学关联")
    return row


def list_records(conn, entity, data):
    label = "title" if entity == "course" else "name"
    search = "%" + data.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    rows = conn.execute(
        f"SELECT id FROM {TABLES[entity]} WHERE (? OR archived=0) AND {label} LIKE ? ESCAPE '\\' ORDER BY created_at,id",
        (data.include_archived, search),
    ).fetchall()
    return {"items": [get_record(conn, entity, row[0]) for row in rows]}


def create_record(conn, entity, data, actor):
    values = data.model_dump()
    if entity == "student":
        require_active(conn, "class", values["class_id"])
    identifier = new_id()
    fields = ["id", *values]
    placeholders = ",".join("?" for _ in fields)
    conn.execute(
        f"INSERT INTO {TABLES[entity]}({','.join(fields)}) VALUES({placeholders})",
        (identifier, *values.values()),
    )
    record = get_record(conn, entity, identifier)
    audit(conn, entity, identifier, "create", actor, None, record)
    return record


def update_record(conn, entity, data, actor):
    before = get_record(conn, entity, data.id)
    if before["version"] != data.version:
        raise DomainError("version_conflict", "记录已更新，请刷新后重试")
    values = data.model_dump(exclude_unset=True, exclude={"id", "version"})
    if not values or any(value is None for value in values.values()):
        raise DomainError("invalid_input", "修改内容不能为空")
    if entity == "course":
        merged = {key: before[key] for key in CourseCreate.model_fields}
        merged.update({key: value for key, value in values.items() if key in merged})
        CourseCreate.model_validate(merged)
    if entity == "student" and "class_id" in values:
        require_active(conn, "class", values["class_id"])
        incompatible = conn.execute(
            """SELECT 1 FROM enrollments e WHERE e.student_id=? AND NOT EXISTS
            (SELECT 1 FROM course_classes c WHERE c.course_id=e.course_id AND c.class_id=?) LIMIT 1""",
            (data.id, values["class_id"]),
        ).fetchone()
        if incompatible:
            raise DomainError("association_conflict", "先将新班级关联至学生已选课程，再调整班级")
    assignments = ",".join(f"{field}=?" for field in values)
    conn.execute(
        f"UPDATE {TABLES[entity]} SET {assignments},version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        (*values.values(), data.id),
    )
    after = get_record(conn, entity, data.id)
    audit(conn, entity, data.id, "update", actor, before, after)
    return after


def assign_class(conn, data, actor):
    require_active(conn, "course", data.course_id)
    require_active(conn, "class", data.class_id)
    conn.execute("INSERT INTO course_classes(course_id,class_id) VALUES(?,?)", (data.course_id, data.class_id))
    result = data.model_dump()
    audit(conn, "course", data.course_id, "assign_class", actor, None, result)
    return result


def enroll(conn, data, actor):
    require_active(conn, "course", data.course_id)
    student = require_active(conn, "student", data.student_id)
    require_active(conn, "class", student["class_id"])
    linked = conn.execute("SELECT 1 FROM course_classes WHERE course_id=? AND class_id=?",
                          (data.course_id, student["class_id"])).fetchone()
    if not linked:
        raise DomainError("association_conflict", "学生班级尚未关联该课程")
    conn.execute("INSERT INTO enrollments(course_id,student_id) VALUES(?,?)", (data.course_id, data.student_id))
    result = data.model_dump()
    audit(conn, "student", data.student_id, "enroll", actor, None, result)
    return result


def list_enrollments(conn, data):
    get_record(conn, "course", data.course_id)
    rows = conn.execute("SELECT * FROM enrollments WHERE course_id=? ORDER BY student_id", (data.course_id,)).fetchall()
    return {"items": [dict(row) for row in rows]}


def list_course_classes(conn, data):
    get_record(conn, "course", data.course_id)
    rows = conn.execute("SELECT class_id FROM course_classes WHERE course_id=? ORDER BY class_id", (data.course_id,)).fetchall()
    return {"items": [get_record(conn, "class", row[0]) for row in rows]}
