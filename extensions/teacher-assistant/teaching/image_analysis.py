"""Compare independently extracted text with the approved blueprint, retaining its layout."""

import hashlib
from unicodedata import normalize

from pydantic import Field

from .database import audit, encode, new_id
from .image_assets import read_asset
from .image_models import BlueprintFilter
from .models import DomainError, Identifier, Policy
from .native_images import config_fingerprint
from .slide_vision import extract_layout


class AnalysisReserve(Identifier):
    estimated_micro_usd: int = Field(ge=1, le=1_000_000_000, strict=True)
    allow_model_call: bool = Field(default=False, strict=True)
    force_regenerate: bool = Field(default=False, strict=True)


def reserve(conn, data, actor):
    from .images import budget, get_job

    asset, _ = read_asset(conn, data)
    parent = get_job(conn, Identifier(id=asset["job_id"]))
    if parent["state"] != "succeeded" or parent["asset_id"] != data.id:
        raise DomainError("review_required", "请选择成功生图任务的当前页面进行文字识别")
    config = config_fingerprint()
    key = hashlib.sha256(("layout-text-v1" + asset["sha256"] + config + parent["blueprint_id"] + str(parent["page_number"])).encode()).hexdigest()
    active = None if data.force_regenerate else conn.execute("SELECT id FROM slide_image_jobs WHERE cache_key=? AND state IN ('queued','running') ORDER BY created_at,id LIMIT 1", (key,)).fetchone()
    if active:
        return get_job(conn, Identifier(id=active[0]))
    cached = None if data.force_regenerate else conn.execute("SELECT id FROM slide_image_jobs WHERE cache_key=? AND state='succeeded' ORDER BY created_at DESC LIMIT 1", (key,)).fetchone()
    if cached:
        return get_job(conn, Identifier(id=cached[0]))
    if not data.allow_model_call:
        raise DomainError("model_call_not_authorized", "请确认将设计图发送给视觉模型并接受估算费用")
    costs = budget(conn, BlueprintFilter(blueprint_id=parent["blueprint_id"]))
    if costs["spent_micro_usd"] + costs["reserved_micro_usd"] + data.estimated_micro_usd > costs["budget_micro_usd"]:
        raise DomainError("budget_exceeded", "视觉检查预算不足，尚未调用模型")
    identifier = new_id()
    conn.execute("""INSERT INTO slide_image_jobs(id,blueprint_id,page_number,prompt,cache_key,config_fingerprint,state,estimated_micro_usd,kind,input_asset_id)
        VALUES(?,?,?,?,?,?,'queued',?,'analysis',?)""", (identifier, parent["blueprint_id"], parent["page_number"], "独立识别可见文字与页面布局，再与蓝图逐字比对", key, config, data.estimated_micro_usd, data.id))
    result = get_job(conn, Identifier(id=identifier))
    audit(conn, "slide_image_job", identifier, "reserve_analysis", actor, None, result)
    return result


def analyze(conn, job, ctx):
    from .blueprint_models import PageRequest
    from .blueprints import get_prompt

    asset, _ = read_asset(conn, Identifier(id=job["input_asset_id"]))
    policy = Policy.model_validate(ctx.get_config("policy", {}))
    model = policy.stage_models.get("slides")
    # The extractor does not receive expected words, so it cannot silently correct a typo from the blueprint.
    layout, usage = extract_layout(ctx, asset["stored_path"], allow_model_call=True, model=model.model_dump() if model else None)
    if (layout.width, layout.height) != (asset["width"], asset["height"]):
        raise DomainError("invalid_model_response", "视觉模型返回的画布尺寸与实际图片不一致")
    page = get_prompt(conn, PageRequest(id=job["blueprint_id"], page_number=job["page_number"]))["page"]
    return {**layout_text_check(layout, page), "layout": layout.model_dump(), "asset_sha256": asset["sha256"],
            "review_note": "视觉识别可能遗漏或误读文字，教师仍需核对教材依据、图解关系、主题一致性和投影可读性"}, {
                "provider": usage["provider"], "model": usage["model"], "reported_cost_usd": usage["cost_usd"]}


def layout_text_check(layout, page):
    texts = []
    for element in layout.elements:
        if element.kind == "text":
            texts.append(element.text)
        elif element.kind == "table":
            texts.extend(cell for row in element.rows for cell in row)
    observed = "".join("".join(normalize("NFKC", text).split()) for text in texts)
    expected = [page["title"], *page["key_messages"]]
    missing = [text for text in expected if "".join(normalize("NFKC", text).split()) not in observed]
    return {"visible_text": texts, "expected_text": expected, "missing_text": missing,
            "text_check": "needs_correction" if missing else "matched_extracted_text"}
