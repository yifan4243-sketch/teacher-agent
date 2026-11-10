"""A lesson binds all subsequent teaching artifacts to immutable textbook sources."""

from pydantic import Field

from .database import audit, new_id
from .knowledge import get_source, get_version
from .models import DomainError, Identifier, Input
from .records import require_active


class LessonCreate(Input):
    course_id: str = Field(min_length=1, max_length=64)
    version_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    objectives: str = Field(default="", max_length=12000)
    key_points: str = Field(default="", max_length=12000)
    difficulties: str = Field(default="", max_length=12000)
    source_ids: list[str] = Field(min_length=1, max_length=100)


def get_lesson(conn, data):
    row = conn.execute("SELECT * FROM lessons WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "课次不存在")
    lesson = dict(row)
    lesson["sources"] = [get_source(conn, Identifier(id=row[0])) for row in conn.execute(
        "SELECT source_id FROM lesson_sources WHERE lesson_id=? ORDER BY ordinal", (data.id,))]
    lesson["timing"] = {"periods": [40, 40], "break_minutes": 10, "instruction_minutes": 80, "span_minutes": 90}
    return lesson


def list_lessons(conn, data):
    require_active(conn, "course", data.course_id)
    return {"items": [dict(row) for row in conn.execute("SELECT * FROM lessons WHERE course_id=? ORDER BY created_at,id", (data.course_id,))]}


def create_lesson(conn, data, actor):
    require_active(conn, "course", data.course_id)
    version = get_version(conn, Identifier(id=data.version_id))
    course = conn.execute("SELECT course_id FROM textbooks WHERE id=?", (version["textbook_id"],)).fetchone()[0]
    if course != data.course_id or len(data.source_ids) != len(set(data.source_ids)):
        raise DomainError("association_conflict", "课次需要同一课程的教材版本及不重复的来源")
    for source_id in data.source_ids:
        source = get_source(conn, Identifier(id=source_id))
        if source["version_id"] != data.version_id:
            raise DomainError("association_conflict", "课次来源必须属于选定教材版本")
    identifier = new_id()
    conn.execute("INSERT INTO lessons(id,course_id,version_id,title,objectives,key_points,difficulties) VALUES(?,?,?,?,?,?,?)",
                 (identifier, data.course_id, data.version_id, data.title, data.objectives, data.key_points, data.difficulties))
    conn.executemany("INSERT INTO lesson_sources VALUES(?,?,?)", [(identifier, source_id, ordinal) for ordinal, source_id in enumerate(data.source_ids, 1)])
    result = get_lesson(conn, Identifier(id=identifier))
    audit(conn, "lesson", identifier, "create", actor, None, result)
    return result
