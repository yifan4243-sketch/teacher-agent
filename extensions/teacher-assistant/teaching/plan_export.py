"""Export plan versions without changing teaching-document DOCX-only rules."""

from datetime import datetime
import hashlib
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator

from . import plan_export_formats
from .database import audit, encode, new_id
from .files import file_root, store_bytes
from .knowledge import get_book, get_version
from .models import DomainError, Identifier
from .planning import get_plan
from .records import get_record


class PlanExport(Identifier):
    format: Literal["docx", "xlsx", "pdf"]
    scope: Literal["semester", "month", "week"] = "semester"
    key: str | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def scope_key(self):
        if (self.scope == "semester") != (self.key is None):
            raise ValueError("全学期不填范围键，月度或每周需提供范围键")
        return self


def _content(conn, data):
    plan = get_plan(conn, data)
    selected, label = None, "全学期"
    if data.scope != "semester":
        groups = plan["months"] if data.scope == "month" else plan["weeks"]
        if data.key not in groups:
            raise DomainError("invalid_scope", "该计划没有指定的月份或教学周")
        selected = set(groups[data.key])
        label = ("月度 " if data.scope == "month" else "每周 ") + data.key
    sessions = [item for item in plan["sessions"] if selected is None or item["id"] in selected]
    course = get_record(conn, "course", plan["course_id"])
    version = get_version(conn, Identifier(id=plan["textbook_version_id"]))
    book = get_book(conn, Identifier(id=version["textbook_id"]))
    published = conn.execute("SELECT active FROM timetable_publications WHERE plan_id=?", (data.id,)).fetchone()
    status = ("已发布计划" if published[0] else "历史计划") if published else "未发布计划"
    return {"title": plan["title"], "version": plan["version"], "course_title": course["title"], "book_title": book["title"],
            "book_version": version["version"], "book_sha256": version["sha256"], "scope_label": label, "status": status,
            "instruction_minutes": sum(item["instruction_minutes"] for item in sessions),
            "assessment_minutes": sum(item["assessment_minutes"] for item in sessions),
            "calendar_minutes": sum(round((datetime.fromisoformat(item["ends_at"]) - datetime.fromisoformat(item["starts_at"])).total_seconds() / 60) for item in sessions),
            "sessions": sessions}


def export(conn, data, actor):
    content = _content(conn, data)
    selection = hashlib.sha256(encode(content).encode()).hexdigest()
    cached = conn.execute("SELECT * FROM plan_exports WHERE plan_id=? AND format=? AND selection_hash=?", (data.id, data.format, selection)).fetchone()
    if cached:
        return _checked(dict(cached))
    output = plan_export_formats.build(content, data.format)
    path, digest = store_bytes(output, "." + data.format)
    identifier = new_id()
    filename = f"教学计划-{content['scope_label'].replace(' ', '-')}-v{content['version']}.{data.format}"
    conn.execute("""INSERT INTO plan_exports(id,plan_id,format,selection_hash,scope_json,stored_path,sha256,byte_size,filename)
        VALUES(?,?,?,?,?,?,?,?,?)""", (identifier, data.id, data.format, selection, encode({"scope": data.scope, "key": data.key}), str(path), digest, len(output), filename))
    result = dict(conn.execute("SELECT * FROM plan_exports WHERE id=?", (identifier,)).fetchone())
    audit(conn, "semester_plan", data.id, "export_" + data.format, actor, None, result)
    return result


def _checked(result):
    path = Path(result["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != result["sha256"]:
        raise DomainError("file_integrity_error", "计划导出文件未通过归属及哈希校验")
    return result


def download(conn, data):
    row = conn.execute("SELECT * FROM plan_exports WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "计划导出文件不存在")
    result = _checked(dict(row))
    return {"stored_path": result["stored_path"], "filename": result["filename"], "sha256": result["sha256"]}
