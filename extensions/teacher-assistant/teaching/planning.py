"""Deterministic calendar allocation; no model invents dates, hours or chapter sources."""

from collections import defaultdict
from datetime import datetime, time, timedelta
import json

from .database import audit, encode, new_id
from .knowledge import get_book, get_version
from .models import DomainError, Identifier
from .records import get_record, require_active


def _chapters(conn, data):
    if "chapters" in data.model_fields_set and not data.chapters:
        raise DomainError("no_chapters", "请至少选择一个教材章节作为课时分配单元")
    rows = conn.execute("SELECT * FROM chapters WHERE version_id=? ORDER BY ordinal", (data.textbook_version_id,)).fetchall()
    by_id = {row["id"]: dict(row) for row in rows}
    selected = [(item.chapter_id, item.difficulty) for item in data.chapters] if data.chapters else [(row["id"], 1) for row in rows if row["parent_id"] is None]
    if not selected or any(identifier not in by_id for identifier, _ in selected):
        raise DomainError("association_conflict", "计划章节需来自所选教材版本，请先核对教材目录")
    identifiers = {identifier for identifier, _ in selected}
    for identifier in identifiers:
        parent = by_id[identifier]["parent_id"]
        while parent:
            if parent in identifiers:
                raise DomainError("overlapping_chapters", "父章节与其子章节不能同时作为独立分配单元")
            parent = by_id[parent]["parent_id"]
    return [(by_id[identifier], weight) for identifier, weight in sorted(selected, key=lambda pair: by_id[pair[0]]["ordinal"])]


def _dates(data):
    slots = defaultdict(list)
    for slot in data.weekly_slots:
        slots[slot.weekday].append(time.fromisoformat(slot.start_time))
    excluded = set(data.excluded_dates)
    current, dates = data.start_date, []
    while current <= data.end_date:
        if current not in excluded:
            dates.extend(datetime.combine(current, clock) for clock in slots[current.weekday()])
        current += timedelta(days=1)
    return sorted(dates)


def _chapter_counts(chapters, available):
    if available < len(chapters):
        raise DomainError("insufficient_sessions", "可用教学课次不足以覆盖所选章节，请调整日期、时段或章节分配单元")
    remaining, total = available - len(chapters), sum(weight for _, weight in chapters)
    counts = [1 + remaining * weight // total for _, weight in chapters]
    ranking = sorted(range(len(chapters)), key=lambda index: (-(remaining * chapters[index][1] % total), index))
    for index in ranking[:available - sum(counts)]:
        counts[index] += 1
    return counts


def _periods(start, course):
    count = course["period_count"]
    break_each = course["break_minutes"] / (count - 1) if count > 1 else 0
    result, current = [], start
    for index in range(count):
        end = current + timedelta(minutes=course["period_minutes"])
        result.append({"kind": "teaching", "start": current.isoformat(timespec="seconds"), "end": end.isoformat(timespec="seconds")})
        current = end
        if index < count - 1:
            end = current + timedelta(minutes=break_each)
            result.append({"kind": "break", "start": current.isoformat(timespec="seconds"), "end": end.isoformat(timespec="seconds")})
            current = end
    return result, current


def _build(conn, data, course):
    chapters = _chapters(conn, data)
    dates = _dates(data)
    counts = _chapter_counts(chapters, len(dates) - data.practice_sessions - data.review_sessions - data.exam_sessions)
    content = [("teaching", chapter["id"], chapter["title"]) for (chapter, _), count in zip(chapters, counts) for _ in range(count)]
    for kind, count, title in (("practice", data.practice_sessions, "综合练习"), ("review", data.review_sessions, "课程复习"), ("exam", data.exam_sessions, "课程考核")):
        content.extend([(kind, None, title)] * count)
    sessions, previous_end = [], None
    for ordinal, (start, (kind, chapter_id, title)) in enumerate(zip(dates, content), 1):
        periods, end = _periods(start, course)
        if kind == "exam":
            end = start + timedelta(minutes=data.exam_minutes)
            periods = [{"kind": "assessment", "start": start.isoformat(timespec="seconds"), "end": end.isoformat(timespec="seconds")}]
        if end.date() != start.date() or previous_end is not None and start < previous_end:
            raise DomainError("schedule_conflict", "课程时段重叠或跨越午夜，请调整每周开始时间")
        previous_end = end
        sessions.append({"ordinal": ordinal, "kind": kind, "chapter_id": chapter_id, "title": title,
                         "starts_at": start.isoformat(timespec="seconds"), "ends_at": end.isoformat(timespec="seconds"),
                         "instruction_minutes": course["instruction_minutes"] if kind != "exam" else 0,
                         "assessment_minutes": data.exam_minutes if kind == "exam" else 0, "periods": periods})
    return sessions


def get_plan(conn, data):
    row = conn.execute("SELECT * FROM semester_plans WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "学期计划不存在")
    result = dict(row)
    result["config"] = json.loads(result.pop("config_json"))
    result["sessions"] = [dict(row) for row in conn.execute("SELECT * FROM planned_sessions WHERE plan_id=? ORDER BY ordinal", (data.id,))]
    weeks, months = defaultdict(list), defaultdict(list)
    for session in result["sessions"]:
        session["periods"] = json.loads(session.pop("timing_json"))
        day = datetime.fromisoformat(session["starts_at"]).date()
        year, week, _ = day.isocalendar()
        weeks[f"{year}-W{week:02d}"].append(session["id"])
        months[day.strftime("%Y-%m")].append(session["id"])
    result["weeks"], result["months"] = dict(weeks), dict(months)
    result["totals"] = {"sessions": len(result["sessions"]), "instruction_minutes": sum(session["instruction_minutes"] for session in result["sessions"]),
                        "assessment_minutes": sum(session["assessment_minutes"] for session in result["sessions"]),
                        "calendar_minutes": sum(round((datetime.fromisoformat(session["ends_at"]) - datetime.fromisoformat(session["starts_at"])).total_seconds() / 60) for session in result["sessions"])}
    return result


def list_plans(conn, data):
    get_record(conn, "course", data.course_id)
    rows = conn.execute("SELECT id,title,version,root_id,textbook_version_id FROM semester_plans WHERE course_id=? ORDER BY created_at DESC,id DESC", (data.course_id,)).fetchall()
    return {"items": [dict(row) for row in rows]}


def save(conn, data, actor):
    require_active(conn, "course", data.course_id)
    course = get_record(conn, "course", data.course_id)
    book = get_version(conn, Identifier(id=data.textbook_version_id))
    if get_book(conn, Identifier(id=book["textbook_id"]))["course_id"] != data.course_id:
        raise DomainError("association_conflict", "学期计划的教材需属于当前课程")
    sessions = _build(conn, data, course)
    parent = get_plan(conn, Identifier(id=data.parent_id)) if data.parent_id else None
    if parent:
        latest = conn.execute("SELECT MAX(version) FROM semester_plans WHERE root_id=?", (parent["root_id"],)).fetchone()[0]
        if parent["version"] != latest or parent["course_id"] != data.course_id:
            raise DomainError("version_conflict", "请从同一课程最新计划版本重新计算")
    identifier = new_id()
    config = {**data.model_dump(mode="json"), "time_basis": "Asia/Shanghai", "course_timing": {key: course[key] for key in (
        "period_minutes", "period_count", "break_minutes", "instruction_minutes", "session_span_minutes")}}
    conn.execute("INSERT INTO semester_plans(id,root_id,parent_id,course_id,textbook_version_id,title,version,config_json,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
                 (identifier, parent["root_id"] if parent else identifier, data.parent_id, data.course_id, data.textbook_version_id,
                  data.title, parent["version"] + 1 if parent else 1, encode(config), actor))
    for session in sessions:
        conn.execute("""INSERT INTO planned_sessions(id,plan_id,ordinal,chapter_id,kind,title,starts_at,ends_at,instruction_minutes,assessment_minutes,timing_json)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (new_id(), identifier, session["ordinal"], session["chapter_id"], session["kind"], session["title"], session["starts_at"],
                session["ends_at"], session["instruction_minutes"], session["assessment_minutes"], encode(session["periods"])))
    result = get_plan(conn, Identifier(id=identifier))
    audit(conn, "semester_plan", identifier, "save_version", actor, parent, result)
    return result
