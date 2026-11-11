"""Commit a single external attempt before dispatch and finish outside long database locks."""

import hashlib
import logging

from . import answer_assets, answer_vision, recognition
from .database import audit, database, encode, new_id
from .exams import get_paper
from .images import _reported_cost
from .models import DomainError, Identifier
from .recognition_models import AnswerPage
from .submissions import check_student


logger = logging.getLogger(__name__)


def run(data, actor, request_id, session_id=None, ctx=None):
    from agent.plugin_llm import PluginLlmTrustError

    if request_id != data.id:
        raise DomainError("invalid_request_id", "执行识别任务时request_id需使用任务ID")
    fingerprint = hashlib.sha256(encode(data.model_dump()).encode()).hexdigest()
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
        if receipt and (receipt["operation"] != "recognition.run" or receipt["fingerprint"] != fingerprint):
            raise DomainError("idempotency_conflict", "该请求ID已用于其他操作")
        before = recognition.get_job(conn, data)
        if receipt or before["state"] != "queued":
            return before
        if not before["model"] and before["routing_fingerprint"] != recognition.default_routing_fingerprint():
            raise DomainError("model_settings_changed", "默认模型路由已变更，请取消旧的排队任务，再按当前设置预留识别任务")
        file = answer_assets.get_file(conn, Identifier(id=before["file_id"]))
        paper = get_paper(conn, Identifier(id=file["paper_id"]))
        check_student(conn, paper["plan"]["course_id"], file["student_id"])
        costs = recognition.budget(conn, Identifier(id=file["id"]))
        if costs["spent_micro_usd"] + before["estimated_micro_usd"] > costs["budget_micro_usd"]:
            raise DomainError("budget_exceeded", "已记录费用达到识别预算，请核对回执及预算")
        token = new_id()
        conn.execute("UPDATE recognition_jobs SET state='running',execution_token=? WHERE id=?", (token, data.id))
        conn.execute("INSERT INTO command_receipts VALUES(?,?,?,?)", (data.id, "recognition.run", fingerprint, encode(recognition.get_job(conn, data))))
    result, usage, error = {}, {}, None
    try:
        with database() as conn:
            page = answer_assets.get_page(conn, AnswerPage(id=file["id"], page_number=before["page_number"]), actor)
        with database() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if recognition.get_job(conn, data)["state"] != "running":
                return recognition.get_job(conn, data)
            conn.execute("UPDATE recognition_jobs SET attempted=1 WHERE id=?", (data.id,))
        result, usage, error = answer_vision.extract(ctx, page, paper, before["model"])
    except PluginLlmTrustError:
        error = "model_permission_denied"
    except DomainError as exc:
        error = exc.code
    except Exception:
        logger.exception("Answer recognition %s failed", data.id)
        error = "recognition_execution_failed"
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        current = recognition.get_job(conn, data)
        if conn.execute("SELECT execution_token FROM recognition_jobs WHERE id=?", (data.id,)).fetchone()[0] != token:
            raise DomainError("execution_conflict", "识别任务执行归属已变化，请核查任务")
        conn.execute("UPDATE recognition_jobs SET result_json=?,usage_json=?,reported_micro_usd=?,error_code=? WHERE id=?",
            (encode(result or {}), encode(usage), _reported_cost(usage.get("cost_usd")), error, data.id))
        if error == "model_permission_denied":
            conn.execute("UPDATE recognition_jobs SET attempted=0 WHERE id=?", (data.id,))
        if current["state"] == "running":
            conn.execute("UPDATE recognition_jobs SET state=? WHERE id=?", ("failed" if error else "succeeded", data.id))
        final = recognition.get_job(conn, data)
        conn.execute("UPDATE command_receipts SET result_json=? WHERE request_id=?", (encode(final), data.id))
        audit(conn, "recognition_job", data.id, "finish", actor, before, final)
        return final
