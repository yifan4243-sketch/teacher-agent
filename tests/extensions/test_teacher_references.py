"""Optional references stay local until per-job consent and reach native image arguments."""

import base64
import hashlib
from pathlib import Path
from types import SimpleNamespace

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_images import image_workspace

__all__ = ["image_workspace", "teacher"]


def upload_reference(call, blueprint, generated):
    content = generated.read_bytes()
    return saved(call, "slide.reference.upload", {"blueprint_id": blueprint["id"], "label": "系统测试参考图",
        "source_note": "系统此前生成的技术样例", "content_base64": base64.b64encode(content).decode(), "sha256": hashlib.sha256(content).hexdigest()})


def test_reference_consent_native_dispatch_cache_archive_and_history(image_workspace, monkeypatch):
    from tools.registry import registry

    call, blueprint, adapter, _, generated = image_workspace
    reference = upload_reference(call, blueprint, generated)
    assert call("slide.reference.preview", {"id": reference["id"]})["ok"]
    assert call("slide.reference.list", {"blueprint_id": blueprint["id"]})["data"]["items"][0]["sha256"] == reference["sha256"]
    assert tool("slide.reference.upload", {}, "agent-reference-upload", name="teacher_slides")["ok"] is False
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 100000})
    params = {"id": blueprint["id"], "page_number": 1, "reference_id": reference["id"], "allow_model_call": True, "estimated_micro_usd": 10000}
    assert call("slide.image.reserve_references", params, "missing-send-consent")["error"]["code"] == "reference_upload_not_authorized"
    params["allow_reference_upload"] = True
    newer = saved(call, "document.save", {"kind": "slide_blueprint", "lesson_id": blueprint["lesson_id"],
        "script_id": blueprint["script_id"], "plan_id": blueprint["plan_id"], "content": blueprint["content"], "expected_version": blueprint["version"]})
    saved(call, "document.review", {"id": newer["id"], "decision": "approved"})
    assert call("slide.image.reserve_references", {**params, "id": newer["id"]}, "wrong-blueprint")["error"]["code"] == "association_conflict"
    job = saved(call, "slide.image.reserve_references", params, "style-job-once")
    assert saved(call, "slide.image.reserve_references", params, "style-job-once")["id"] == job["id"]
    assert job["reference"]["sha256"] == reference["sha256"]
    calls = []
    original = registry.dispatch

    def dispatch(name, args, **kwargs):
        if name != "image_generate":
            return original(name, args, **kwargs)
        calls.append(args)
        assert Path(args["image_url"]).read_bytes() == generated.read_bytes()
        assert "不得复制图片中的教学结论" in args["prompt"]
        return {"success": True, "image": str(generated), "provider": "offline fixture", "model": "style-aware"}

    monkeypatch.setattr(registry, "dispatch", dispatch)
    monkeypatch.setattr(adapter, "tool_entry", lambda: SimpleNamespace(schema={"parameters": {"properties": {}}},
        dynamic_schema_overrides=lambda: {"parameters": {"properties": {"image_url": {"type": "string"}}}}))
    assert saved(call, "slide.image.run", {"id": job["id"]}, job["id"])["state"] == "succeeded"
    assert saved(call, "slide.image.reserve_references", params)["state"] == "cached"
    assert len(calls) == 1
    unstyled = saved(call, "slide.image.reserve", {key: value for key, value in params.items() if key not in ("reference_id", "allow_reference_upload")})
    assert unstyled["state"] == "queued" and unstyled["reference"] is None
    saved(call, "slide.reference.archive", {"id": reference["id"]})
    assert call("slide.reference.preview", {"id": reference["id"]})["ok"]
    assert call("slide.image.reserve_references", params, "archived-reference")["error"]["code"] == "association_conflict"
    assert call("slide.image.get", {"id": job["id"]})["data"]["reference"]["id"] == reference["id"]


def test_reference_validation_and_unsupported_model_fail_before_billable_attempt(image_workspace, monkeypatch):
    call, blueprint, adapter, _, generated = image_workspace
    invalid = {"blueprint_id": blueprint["id"], "label": "invalid", "content_base64": base64.b64encode(b"not an image").decode(), "sha256": hashlib.sha256(b"not an image").hexdigest()}
    assert call("slide.reference.upload", invalid, "invalid-image")["error"]["code"] == "invalid_image"
    reference = upload_reference(call, blueprint, generated)
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 100000})
    params = {"id": blueprint["id"], "page_number": 1, "reference_id": reference["id"], "allow_reference_upload": True, "allow_model_call": True, "estimated_micro_usd": 10000}
    job = saved(call, "slide.image.reserve_references", params)
    monkeypatch.setattr(adapter, "tool_entry", lambda: SimpleNamespace(schema={"parameters": {"properties": {}}}, dynamic_schema_overrides=None))
    finished = saved(call, "slide.image.run", {"id": job["id"]}, job["id"])
    assert finished["state"] == "failed" and finished["error_code"] == "reference_not_supported" and not finished["attempted"]
    assert call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]["spent_micro_usd"] == 0
    queued = saved(call, "slide.image.reserve_references", params)
    Path(reference["stored_path"]).write_bytes(b"tampered fixture file")
    result = saved(call, "slide.image.run", {"id": queued["id"]}, queued["id"])
    assert result["error_code"] == "file_integrity_error" and not result["attempted"]
    assert call("slide.reference.preview", {"id": reference["id"]})["error"]["code"] == "file_integrity_error"
