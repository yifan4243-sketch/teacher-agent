"""Reserve image costs before dispatch and never repeat a claimed external attempt."""

from decimal import Decimal, InvalidOperation, ROUND_CEILING
import hashlib
import json
import logging
from pathlib import Path

from . import image_analysis, image_assets, native_images
from .blueprints import get_prompt
from .blueprint_models import PageRequest
from .database import audit, database, encode, new_id
from .documents import get_document
from .models import DomainError, Identifier


logger = logging.getLogger(__name__)


def _blueprint(conn, identifier):
    document = get_document(conn, Identifier(id=identifier))
    if document["kind"] != "slide_blueprint" or document["status"] != "approved":
        raise DomainError("review_required", "图片生成需要教师已审核的页面蓝图版本")
    return document


def budget(conn, data):
    _blueprint(conn, data.blueprint_id)
    row = conn.execute("SELECT budget_micro_usd FROM slide_image_budgets WHERE blueprint_id=?", (data.blueprint_id,)).fetchone()
    totals = conn.execute("""SELECT COALESCE(SUM(CASE WHEN state IN ('queued','running') THEN estimated_micro_usd ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN state NOT IN ('queued','running') AND attempted=1 THEN COALESCE(reported_micro_usd,estimated_micro_usd) ELSE 0 END),0)
        FROM slide_image_jobs WHERE blueprint_id=?""", (data.blueprint_id,)).fetchone()
    return {"blueprint_id": data.blueprint_id, "budget_micro_usd": row[0] if row else 0,
            "reserved_micro_usd": totals[0], "spent_micro_usd": totals[1],
            "cost_basis": "调用前预留教师填写的估算费用，服务报告费用存在时更新，缺失时保留估算，非服务商结算账单"}


def set_budget(conn, data, actor):
    before = budget(conn, data)
    if data.budget_micro_usd < before["reserved_micro_usd"] + before["spent_micro_usd"]:
        raise DomainError("budget_conflict", "预算不能低于已预留与已记录的费用")
    conn.execute("INSERT INTO slide_image_budgets VALUES(?,?) ON CONFLICT(blueprint_id) DO UPDATE SET budget_micro_usd=excluded.budget_micro_usd",
                 (data.blueprint_id, data.budget_micro_usd))
    result = budget(conn, data)
    audit(conn, "slide_budget", data.blueprint_id, "set", actor, before, result)
    return result


def get_job(conn, data):
    row = conn.execute("SELECT * FROM slide_image_jobs WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "图片任务不存在")
    result = dict(row)
    result.pop("execution_token")
    result["analysis"] = json.loads(result.pop("result_json"))
    result["assets"] = [dict(row) for row in conn.execute("""SELECT * FROM slide_image_assets WHERE job_id=? OR id=?
        OR id=(SELECT source_asset_id FROM slide_image_assets WHERE id=?) ORDER BY created_at,id""", (data.id, result["asset_id"], result["asset_id"]))]
    return result


def list_jobs(conn, data):
    _blueprint(conn, data.blueprint_id)
    rows = conn.execute("SELECT id FROM slide_image_jobs WHERE blueprint_id=? ORDER BY created_at,id LIMIT ? OFFSET ?", (data.blueprint_id, data.limit, data.offset)).fetchall()
    items = []
    for row in rows:
        job = get_job(conn, Identifier(id=row[0]))
        job.pop("prompt")
        job["analysis"].pop("layout", None)
        items.append(job)
    total = conn.execute("SELECT COUNT(*) FROM slide_image_jobs WHERE blueprint_id=?", (data.blueprint_id,)).fetchone()[0]
    return {"items": items, "total": total, "next_offset": data.offset + len(items) if data.offset + len(items) < total else None}


def reserve(conn, data, actor):
    from .image_models import BlueprintFilter

    _blueprint(conn, data.id)
    prompt = get_prompt(conn, data)["prompt"]
    config = native_images.config_fingerprint()
    key = hashlib.sha256((prompt + config).encode("utf-8")).hexdigest()
    active = None if data.force_regenerate else conn.execute("SELECT id FROM slide_image_jobs WHERE cache_key=? AND state IN ('queued','running') ORDER BY created_at,id LIMIT 1", (key,)).fetchone()
    if active:
        return get_job(conn, Identifier(id=active[0]))
    cached = None if data.force_regenerate else conn.execute("""SELECT j.asset_id,j.provider,j.model,a.stored_path,a.sha256
        FROM slide_image_jobs j JOIN slide_image_assets a ON a.id=j.asset_id WHERE j.cache_key=? AND j.state='succeeded' AND a.verification_status!='rejected'
        ORDER BY j.created_at DESC LIMIT 1""", (key,)).fetchone()
    if cached and (not Path(cached["stored_path"]).is_file() or hashlib.sha256(Path(cached["stored_path"]).read_bytes()).hexdigest() != cached["sha256"]):
        cached = None
    if not cached and not data.allow_model_call:
        raise DomainError("model_call_not_authorized", "请确认本次生图服务调用及估算费用")
    costs = budget(conn, BlueprintFilter(blueprint_id=data.id))
    if not cached and costs["spent_micro_usd"] + costs["reserved_micro_usd"] + data.estimated_micro_usd > costs["budget_micro_usd"]:
        raise DomainError("budget_exceeded", "课件任务预算不足，尚未调用生图服务")
    identifier = new_id()
    conn.execute("""INSERT INTO slide_image_jobs(id,blueprint_id,page_number,prompt,cache_key,config_fingerprint,state,estimated_micro_usd,asset_id,provider,model)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (identifier, data.id, data.page_number, prompt, key, config, "cached" if cached else "queued",
                                         0 if cached else data.estimated_micro_usd, cached["asset_id"] if cached else None,
                                         cached["provider"] if cached else None, cached["model"] if cached else None))
    result = get_job(conn, Identifier(id=identifier))
    audit(conn, "slide_image_job", identifier, "reserve", actor, None, result)
    return result


def abandon(conn, data, actor):
    before = get_job(conn, data)
    if before["state"] not in {"queued", "running"}:
        raise DomainError("invalid_transition", "此图片任务已经结束")
    if before["attempted"] and not data.acknowledge_possible_cost:
        raise DomainError("cost_acknowledgement_required", "该请求可能已产生费用，请先确认再取消保存")
    conn.execute("UPDATE slide_image_jobs SET state='cancelled',error_code='teacher_cancelled' WHERE id=?", (data.id,))
    result = get_job(conn, data)
    audit(conn, "slide_image_job", data.id, "abandon", actor, before, result)
    return result


def _reported_cost(value):
    if value is None:
        return None
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount > 1_000_000:
            return None
        return int((amount * 1_000_000).to_integral_value(rounding=ROUND_CEILING))
    except InvalidOperation:
        return None


def execute(data, actor, request_id, session_id=None, ctx=None):
    if request_id != data.id:
        raise DomainError("invalid_request_id", "执行图片任务时request_id需使用该任务ID")
    fingerprint = hashlib.sha256(encode(data.model_dump()).encode("utf-8")).hexdigest()
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
        if receipt and (receipt["operation"] != "slide.image.run" or receipt["fingerprint"] != fingerprint):
            raise DomainError("idempotency_conflict", "任务请求ID已用于其他操作")
        job = get_job(conn, data)
        if receipt or job["state"] != "queued":
            return job
        token = new_id()
        conn.execute("UPDATE slide_image_jobs SET state='running',execution_token=? WHERE id=?", (token, data.id))
        conn.execute("INSERT INTO command_receipts VALUES(?,?,?,?)", (request_id, "slide.image.run", fingerprint, encode(get_job(conn, data))))
    # The claim commits before an external request. A replay observes the claim and cannot spend again.
    info, assets, error, analysis = {}, [], None, {}
    try:
        if job["kind"] == "generation":
            native_images.tool_entry()
        if native_images.config_fingerprint() != job["config_fingerprint"]:
            raise DomainError("image_configuration_changed", "生图配置已变化，请重新预留图片任务")
        with database() as conn:
            conn.execute("BEGIN IMMEDIATE")
            state = conn.execute("SELECT state FROM slide_image_jobs WHERE id=?", (data.id,)).fetchone()[0]
            if state != "running":
                return get_job(conn, data)
            conn.execute("UPDATE slide_image_jobs SET attempted=1 WHERE id=?", (data.id,))
        if job["kind"] == "analysis":
            with database() as conn:
                analysis, info = image_analysis.analyze(conn, job, ctx)
        else:
            path, info = native_images.generate(job["prompt"], session_id)
            with database() as conn:
                prompt = get_prompt(conn, PageRequest(id=job["blueprint_id"], page_number=job["page_number"]))
            assets = image_assets.store_design(path, prompt["theme"]["background"])
            if assets[-1]["verification_status"] == "aspect_ratio_mismatch":
                error = "aspect_ratio_mismatch"
    except DomainError as exc:
        error = exc.code
    except (OSError, ValueError):
        error = "image_result_failed"
    except Exception:
        logger.exception("Image job %s failed at the external service boundary", data.id)
        error = "image_execution_failed"
    return _finish(data, token, assets, info, error, analysis, actor)


def _finish(data, token, assets, info, error, analysis, actor):
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        before = get_job(conn, data)
        if conn.execute("SELECT execution_token FROM slide_image_jobs WHERE id=?", (data.id,)).fetchone()[0] != token:
            raise DomainError("execution_conflict", "图片执行归属发生变化，请核查任务")
        for asset in assets:
            conn.execute("""INSERT INTO slide_image_assets(id,job_id,stored_path,sha256,byte_size,width,height,format,verification_status,source_asset_id,processing_json)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (asset["id"], data.id, asset["stored_path"], asset["sha256"], asset["byte_size"], asset["width"], asset["height"], asset["format"], asset["verification_status"], asset["source_asset_id"], asset["processing_json"]))
        conn.execute("UPDATE slide_image_jobs SET reported_micro_usd=?,provider=?,model=?,result_json=? WHERE id=?",
                     (_reported_cost(info.get("reported_cost_usd")), info.get("provider"), info.get("model"), encode(analysis), data.id))
        if error == "model_permission_denied":
            conn.execute("UPDATE slide_image_jobs SET attempted=0 WHERE id=?", (data.id,))
        if before["state"] == "running":
            conn.execute("UPDATE slide_image_jobs SET state=?,asset_id=?,error_code=? WHERE id=?", ("failed" if error else "succeeded", assets[-1]["id"] if assets else None, error, data.id))
        result = get_job(conn, data)
        conn.execute("UPDATE command_receipts SET result_json=? WHERE request_id=?", (encode(result), data.id))
        audit(conn, "slide_image_job", data.id, "finish", actor, before, result)
        return result
