"""Immutable paper versions validate the saved blueprint against exact bank versions."""

from collections import Counter
import json

from .database import audit, encode, new_id
from . import exam_scope
from .models import DomainError, Identifier
from .questions import get_question
from .records import get_record, require_active


def get_plan(conn, data):
    row = conn.execute("SELECT * FROM exam_plans WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "命题方案不存在")
    result = dict(row)
    result["config"] = json.loads(result.pop("config_json"))
    result["scope"] = json.loads(result.pop("scope_json"))
    result["latest_version"] = conn.execute("SELECT MAX(version) FROM exam_plans WHERE root_id=?", (result["root_id"],)).fetchone()[0]
    return result


def list_plans(conn, data):
    get_record(conn, "course", data.course_id)
    rows = conn.execute("SELECT id FROM exam_plans WHERE course_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?", (data.course_id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM exam_plans WHERE course_id=?", (data.course_id,)).fetchone()[0]
    return {"items": [get_plan(conn, Identifier(id=row[0])) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def _previous(conn, table, root_id, expected_version):
    previous = conn.execute(f"SELECT id,root_id,version FROM {table} WHERE root_id=? ORDER BY version DESC LIMIT 1", (root_id,)).fetchone() if root_id else None
    if root_id and previous is None:
        raise DomainError("not_found", "待修订的命题方案或试卷不存在")
    if expected_version != (previous["version"] if previous else 0):
        raise DomainError("version_conflict", "已有新版本，请刷新后修订")
    return dict(previous) if previous else None


def save_plan(conn, data, actor):
    require_active(conn, "course", data.course_id)
    previous = _previous(conn, "exam_plans", data.root_id, data.expected_version)
    if previous and get_plan(conn, Identifier(id=previous["id"]))["course_id"] != data.course_id:
        raise DomainError("association_conflict", "命题方案修订需属于同一课程")
    scope = exam_scope.resolve(conn, data)
    identifier = new_id()
    conn.execute("""INSERT INTO exam_plans(id,root_id,parent_id,version,course_id,textbook_version_id,title,config_json,scope_json,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?)""", (identifier, data.root_id or identifier, previous["id"] if previous else None,
        data.expected_version + 1, data.course_id, data.textbook_version_id, data.title, encode(data.config.model_dump()), encode(scope), actor))
    result = get_plan(conn, Identifier(id=identifier))
    audit(conn, "exam_plan", identifier, "save_version", actor, previous, result)
    return result


def get_paper(conn, data):
    row = conn.execute("SELECT * FROM exam_papers WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "试卷版本不存在")
    result = dict(row)
    result["report"] = json.loads(result.pop("report_json"))
    result["plan"] = get_plan(conn, Identifier(id=result["plan_id"]))
    result["questions"] = [get_question(conn, Identifier(id=row[0])) for row in conn.execute("SELECT question_id FROM exam_questions WHERE paper_id=? ORDER BY ordinal", (data.id,))]
    result["latest_version"] = conn.execute("SELECT MAX(version) FROM exam_papers WHERE root_id=?", (result["root_id"],)).fetchone()[0]
    return result


def list_papers(conn, data):
    get_record(conn, "course", data.course_id)
    rows = conn.execute("""SELECT p.*,s.course_id FROM exam_papers p JOIN exam_plans s ON s.id=p.plan_id
        WHERE s.course_id=? ORDER BY p.rowid DESC LIMIT ? OFFSET ?""", (data.course_id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM exam_papers p JOIN exam_plans s ON s.id=p.plan_id WHERE s.course_id=?", (data.course_id,)).fetchone()[0]
    items = []
    for row in rows:
        item = dict(row)
        item["report"] = json.loads(item.pop("report_json"))
        items.append(item)
    return {"items": items, "total": total, "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def _check_questions(plan, questions):
    config, scope = plan["config"], plan["scope"]
    if len({question["root_id"] for question in questions}) != len(questions) or len({question["prompt_hash"] for question in questions}) != len(questions):
        raise DomainError("duplicate_questions", "同一试卷不能重复使用同一题目或归一化后相同的题干")
    allowed_sources = set(scope["source_ids"])
    allowed_points = {point["id"] for point in scope["knowledge_points"]}
    for question in questions:
        if question["course_id"] != plan["course_id"] or question["textbook_version_id"] != plan["textbook_version_id"]:
            raise DomainError("association_conflict", "试题需属于命题方案课程及教材版本")
        content = question["content"]
        if not set(content["source_ids"]) <= allowed_sources or not set(content["knowledge_point_ids"]) <= allowed_points:
            raise DomainError("association_conflict", "试题引用超出命题方案保存的教材及知识点范围")
        if question["status"] == "rejected":
            raise DomainError("review_required", "已退回的题目需修订后才能组卷")
    kinds = Counter(question["kind"] for question in questions)
    difficulties = Counter(question["difficulty"] for question in questions)
    total = sum(question["points_centi"] for question in questions)
    if kinds != {item["kind"]: item["count"] for item in config["question_types"]}:
        raise DomainError("exam_constraint_failed", "实际题型数量与命题方案不一致")
    if config["difficulties"] and difficulties != {item["difficulty"]: item["count"] for item in config["difficulties"]}:
        raise DomainError("exam_constraint_failed", "实际难度分布与命题方案不一致")
    if total != config["total_points_centi"]:
        raise DomainError("exam_constraint_failed", "题目分值合计与命题方案总分不一致")
    covered = {point for question in questions for point in question["content"]["knowledge_point_ids"]}
    if len(covered) * 100 < config["coverage_percent"] * len(allowed_points):
        raise DomainError("exam_constraint_failed", "试题知识点覆盖比例不足")
    return {"question_count": len(questions), "total_points_centi": total, "question_types": dict(kinds),
            "difficulties": dict(difficulties), "covered_point_ids": sorted(covered), "scope_point_count": len(allowed_points),
            "coverage_percent": round(100 * len(covered) / len(allowed_points), 2) if allowed_points else None}


def save_paper(conn, data, actor):
    plan = get_plan(conn, Identifier(id=data.plan_id))
    require_active(conn, "course", plan["course_id"])
    previous = _previous(conn, "exam_papers", data.root_id, data.expected_version)
    if previous and get_paper(conn, Identifier(id=previous["id"]))["plan"]["course_id"] != plan["course_id"]:
        raise DomainError("association_conflict", "试卷修订需属于同一课程")
    questions = [get_question(conn, Identifier(id=identifier)) for identifier in data.question_ids]
    report = _check_questions(plan, questions)
    identifier = new_id()
    conn.execute("""INSERT INTO exam_papers(id,root_id,parent_id,version,plan_id,title,report_json,created_by)
        VALUES(?,?,?,?,?,?,?,?)""", (identifier, data.root_id or identifier, previous["id"] if previous else None,
        data.expected_version + 1, data.plan_id, data.title, encode(report), actor))
    conn.executemany("INSERT INTO exam_questions VALUES(?,?,?)", [(identifier, index, question_id) for index, question_id in enumerate(data.question_ids, 1)])
    if data.generation_id:
        from .exam_generation import attach_paper
        attach_paper(conn, data, identifier)
    elif previous:
        _follow_revision(conn, previous["id"], identifier, data.plan_id)
    result = get_paper(conn, Identifier(id=identifier))
    audit(conn, "exam_paper", identifier, "save_version", actor, previous, result)
    return result


def _follow_revision(conn, previous_id, identifier, plan_id):
    pending = conn.execute("""SELECT g.workflow_id FROM exam_generations g JOIN workflows w ON w.id=g.workflow_id
        WHERE g.paper_id=? AND g.plan_id=? AND w.status='awaiting_review'""", (previous_id, plan_id)).fetchall()
    for row in pending:
        conn.execute("UPDATE exam_generations SET paper_id=? WHERE workflow_id=?", (identifier, row[0]))
        conn.execute("UPDATE workflows SET result_json=?,version=version+1 WHERE id=?", (encode({"paper_id": identifier}), row[0]))
        conn.execute("INSERT INTO workflow_steps(workflow_id,step_key,result_json) VALUES(?,?,?)",
            (row[0], "exam.revised-" + identifier, encode({"paper_id": identifier})))


def review_paper(conn, data, actor):
    before = get_paper(conn, data)
    require_active(conn, "course", before["plan"]["course_id"])
    if before["status"] != "draft":
        raise DomainError("invalid_transition", "已审核试卷需另存修订版后再审核")
    if data.decision == "approved":
        _check_questions(before["plan"], before["questions"])
        if any(question["status"] != "approved" for question in before["questions"]):
            raise DomainError("review_required", "请先在题库审核试卷使用的每个题目版本")
    conn.execute("UPDATE exam_papers SET status=?,reviewed_by=?,review_note=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        (data.decision, actor, data.note, data.id))
    conn.execute("""UPDATE workflows SET status=?,version=version+1 WHERE id IN
        (SELECT workflow_id FROM exam_generations WHERE paper_id=?) AND status='awaiting_review'""",
        ("completed" if data.decision == "approved" else "cancelled", data.id))
    result = get_paper(conn, data)
    audit(conn, "exam_paper", data.id, "review", actor, before, result)
    return result
