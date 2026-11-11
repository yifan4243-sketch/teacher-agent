"""Report actual approved artifacts for the lesson explicitly linked to a calendar event."""

import json

from .models import DomainError


def lesson_status(conn, lesson_id):
    approved = {row[0] for row in conn.execute("SELECT DISTINCT kind FROM teaching_documents WHERE lesson_id=? AND status='approved'", (lesson_id,))}
    blueprint = conn.execute("SELECT id,version,content_json FROM teaching_documents WHERE lesson_id=? AND kind='slide_blueprint' AND status='approved' ORDER BY version DESC LIMIT 1", (lesson_id,)).fetchone()
    pages = json.loads(blueprint["content_json"])["pages"] if blueprint else []
    numbers = {page["number"] for page in pages}
    reviewed = {row[0] for row in conn.execute("SELECT DISTINCT page_number FROM slide_pages WHERE blueprint_id=? AND status='approved'", (blueprint["id"] if blueprint else None,))}
    return {"lesson_id": lesson_id, "script_approved": "script" in approved, "plan_approved": "lesson_plan" in approved,
            "blueprint_id": blueprint["id"] if blueprint else None, "blueprint_version": blueprint["version"] if blueprint else None,
            "slide_pages": len(numbers), "approved_slide_pages": len(numbers & reviewed)}


def for_event(conn, data):
    event = conn.execute("SELECT lesson_id FROM timetable_events WHERE id=?", (data.id,)).fetchone()
    if event is None:
        raise DomainError("not_found", "课表课次不存在")
    return lesson_status(conn, event["lesson_id"])


def summary(status):
    parts = ["授课稿已审核" if status["script_approved"] else "授课稿待准备", "教案已审核" if status["plan_approved"] else "教案待准备"]
    parts.append(f"PPT已审核{status['approved_slide_pages']}/{status['slide_pages']}页" if status["blueprint_id"] else "PPT尚无审核蓝图")
    if not status["lesson_id"]:
        parts.append("请在课表关联备课课次")
    return "，".join(parts)
