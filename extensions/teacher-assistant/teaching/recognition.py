"""Reserve authorized page jobs and retain their results, costs and cancellation state."""

import hashlib
import json

from .answer_assets import get_file
from .database import audit, encode, new_id
from .exams import get_paper
from .models import DomainError, Identifier, Policy
from .submissions import check_student


def default_routing_fingerprint():
    from hermes_cli.config import load_config_readonly

    config = load_config_readonly()
    return hashlib.sha256(encode(config.get("model", {})).encode()).hexdigest()


def get_job(conn, data):
    row = conn.execute("SELECT * FROM recognition_jobs WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "答卷识别任务不存在")
    result = dict(row)
    result.pop("execution_token")
    for key in ("model", "usage", "result"):
        result[key] = json.loads(result.pop(key + "_json"))
    return result


def list_jobs(conn, data):
    get_file(conn, data)
    rows = conn.execute("SELECT id FROM recognition_jobs WHERE file_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?", (data.id, data.limit, data.offset)).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM recognition_jobs WHERE file_id=?", (data.id,)).fetchone()[0]
    return {"items": [get_job(conn, Identifier(id=row[0])) for row in rows], "total": total,
            "next_offset": data.offset + len(rows) if data.offset + len(rows) < total else None}


def budget(conn, data):
    get_file(conn, data)
    row = conn.execute("SELECT budget_micro_usd FROM recognition_budgets WHERE file_id=?", (data.id,)).fetchone()
    totals = conn.execute("""SELECT COALESCE(SUM(CASE WHEN state IN ('queued','running') THEN estimated_micro_usd ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN state NOT IN ('queued','running') AND attempted=1 THEN COALESCE(reported_micro_usd,estimated_micro_usd) ELSE 0 END),0)
        FROM recognition_jobs WHERE file_id=?""", (data.id,)).fetchone()
    return {"file_id": data.id, "budget_micro_usd": row[0] if row else 0, "reserved_micro_usd": totals[0], "spent_micro_usd": totals[1],
            "cost_basis": "按教师估算预留，服务回执存在时更新，缺少回执时按已尝试任务的估算记账，实际结算以服务商账单为准"}


def set_budget(conn, data, actor):
    before = budget(conn, data)
    if data.budget_micro_usd < before["reserved_micro_usd"] + before["spent_micro_usd"]:
        raise DomainError("budget_conflict", "识别预算不能低于已预留和已记录的费用")
    conn.execute("INSERT INTO recognition_budgets VALUES(?,?) ON CONFLICT(file_id) DO UPDATE SET budget_micro_usd=excluded.budget_micro_usd", (data.id, data.budget_micro_usd))
    result = budget(conn, data)
    audit(conn, "recognition_budget", data.id, "set", actor, before, result)
    return result


def reserve(conn, data, actor, ctx):
    file = get_file(conn, data)
    paper = get_paper(conn, Identifier(id=file["paper_id"]))
    check_student(conn, paper["plan"]["course_id"], file["student_id"])
    if len(data.pages) != len(set(data.pages)) or any(page > file["page_count"] for page in data.pages):
        raise DomainError("invalid_page", "所选页号需在答卷实际页数内且不重复")
    policy = Policy.model_validate(ctx.get_config("policy", {}))
    selection = policy.stage_models.get("grading")
    model = selection.model_dump() if selection else {}
    routing = "" if model else default_routing_fingerprint()
    pending, selected = [], []
    for page in sorted(data.pages):
        key = hashlib.sha256(encode({"file_id": data.id, "sha256": file["sha256"], "page": page, "model": model, "routing": routing, "extractor": 1}).encode()).hexdigest()
        cached = None if data.force_regenerate else conn.execute("SELECT id FROM recognition_jobs WHERE cache_key=? AND state IN ('queued','running','succeeded') ORDER BY rowid DESC LIMIT 1", (key,)).fetchone()
        if cached:
            selected.append(cached[0])
        else:
            identifier = new_id()
            selected.append(identifier)
            pending.append((identifier, data.id, page, encode(model), routing, key, data.estimated_micro_usd))
    if pending:
        if not data.allow_model_call:
            raise DomainError("model_call_not_authorized", "请授权将所选答卷页面发送给视觉模型并接受估算费用")
        costs = budget(conn, data)
        if costs["spent_micro_usd"] + costs["reserved_micro_usd"] + len(pending) * data.estimated_micro_usd > costs["budget_micro_usd"]:
            raise DomainError("budget_exceeded", "答卷识别预算不足，模型尚未调用")
        conn.executemany("INSERT INTO recognition_jobs(id,file_id,page_number,state,model_json,routing_fingerprint,cache_key,estimated_micro_usd) VALUES(?,?,?,'queued',?,?,?,?)", pending)
    result = {"items": [get_job(conn, Identifier(id=identifier)) for identifier in selected], "new_job_count": len(pending)}
    audit(conn, "answer_file", data.id, "reserve_recognition", actor, None, {"job_ids": selected, "new_job_count": len(pending)})
    return result


def cancel(conn, data, actor):
    before = get_job(conn, data)
    if before["state"] not in {"queued", "running"}:
        raise DomainError("invalid_transition", "该识别任务已经结束")
    if before["attempted"] and not data.acknowledge_possible_cost:
        raise DomainError("cost_acknowledgement_required", "识别请求可能已产生费用，请确认后取消保存")
    conn.execute("UPDATE recognition_jobs SET state='cancelled',error_code='teacher_cancelled' WHERE id=?", (data.id,))
    result = get_job(conn, data)
    audit(conn, "recognition_job", data.id, "cancel", actor, before, result)
    return result
