"""Image costs and actual image files under mocked provider responses, never paid calls."""

from concurrent.futures import ThreadPoolExecutor
import base64
import hashlib
import importlib
import json
from pathlib import Path
import shutil
from threading import Event

import pytest

from tests.extensions.test_teacher_blueprints import preparation_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool

__all__ = ["teacher"]


@pytest.fixture
def image_workspace(teacher, tmp_path, monkeypatch):
    home, manager, call = teacher
    _, _, _, params = preparation_fixture(call, tmp_path)
    blueprint = saved(call, "document.save", params)
    saved(call, "document.review", {"id": blueprint["id"], "decision": "approved"})
    prefix = manager._plugins["teacher-assistant"].module.__name__
    adapter = importlib.import_module(prefix + ".teaching.native_images")
    errors = importlib.import_module(prefix + ".teaching.models")
    monkeypatch.setattr(adapter, "tool_entry", lambda: None)
    source = Path(__file__).resolve().parents[2] / "extensions/teacher-assistant/resources/slide-prototype/generated-design.jpg"
    generated = home / "cache/generated/images/teacher-test.jpg"
    generated.parent.mkdir(parents=True)
    shutil.copy2(source, generated)
    return call, blueprint, adapter, errors, generated


def test_budget_gate_image_files_replay_and_cache(image_workspace, monkeypatch):
    call, blueprint, adapter, _, generated = image_workspace
    calls = []

    def generate(prompt, task_id):
        calls.append(prompt)
        return generated, {"provider": "scripted", "model": "fixture", "reported_cost_usd": "0.01"}

    monkeypatch.setattr(adapter, "generate", generate)
    params = {"id": blueprint["id"], "page_number": 1, "estimated_micro_usd": 20000, "allow_model_call": True}
    assert call("slide.image.reserve", params, "unfunded")["error"]["code"] == "budget_exceeded"
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 30000})
    assert tool("slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 999999}, "agent-budget", name="teacher_slides")["ok"] is False
    queued = saved(call, "slide.image.reserve", params)
    assert saved(call, "slide.image.reserve", {**params, "allow_model_call": False})["id"] == queued["id"]
    assert call("slide.image.reserve", {**params, "page_number": 2}, "over-limit")["error"]["code"] == "budget_exceeded"
    assert not calls
    finished = saved(call, "slide.image.run", {"id": queued["id"]}, queued["id"])
    assert finished["state"] == "succeeded", finished
    asset = finished["assets"][0]
    assert asset["sha256"] == hashlib.sha256(generated.read_bytes()).hexdigest()
    assert Path(asset["stored_path"]).read_bytes() == generated.read_bytes()
    assert asset["verification_status"] == "needs_text_review"
    assert saved(call, "slide.image.run", {"id": queued["id"]}, queued["id"])["id"] == queued["id"]
    assert len(calls) == 1
    cached = saved(call, "slide.image.reserve", {**params, "allow_model_call": False})
    assert cached["state"] == "cached" and cached["assets"][0]["id"] == asset["id"]
    costs = call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]
    assert costs["spent_micro_usd"] == 10000 and costs["reserved_micro_usd"] == 0
    listed = call("slide.image.list", {"blueprint_id": blueprint["id"], "limit": 1})["data"]
    assert listed["total"] == 2 and listed["next_offset"] == 1
    assert "prompt" not in listed["items"][0]


def test_native_adapter_uses_published_dispatch_and_confines_result_paths(image_workspace, monkeypatch, tmp_path):
    from tools.registry import registry

    _, _, adapter, errors, generated = image_workspace
    invocations = []

    def dispatch(name, args, **kwargs):
        invocations.append((name, args, kwargs))
        return json.dumps({"success": True, "image": str(generated), "provider": "scripted", "model": "fixture"})

    monkeypatch.setattr(registry, "dispatch", dispatch)
    path, _ = adapter.generate("a classroom slide", "native-session")
    assert path == generated
    assert invocations == [("image_generate", {"prompt": "a classroom slide", "aspect_ratio": "landscape"}, {"task_id": "native-session"})]
    outside = tmp_path / "outside.jpg"
    shutil.copy2(generated, outside)
    monkeypatch.setattr(registry, "dispatch", lambda *args, **kwargs: {"success": True, "image": str(outside)})
    with pytest.raises(errors.DomainError, match="当前配置"):
        adapter.generate("a classroom slide", None)


def test_concurrent_run_and_late_cancel_result_do_not_spend_twice(image_workspace, monkeypatch):
    call, blueprint, adapter, _, generated = image_workspace
    entered, release = Event(), Event()
    calls = []

    def generate(prompt, task_id):
        calls.append(prompt)
        entered.set()
        assert release.wait(30)
        return generated, {"provider": "scripted", "model": "fixture", "reported_cost_usd": "0.01"}

    monkeypatch.setattr(adapter, "generate", generate)
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 50000})
    queued = saved(call, "slide.image.reserve", {"id": blueprint["id"], "page_number": 1, "estimated_micro_usd": 20000, "allow_model_call": True})
    with ThreadPoolExecutor(max_workers=2) as executor:
        future = executor.submit(saved, call, "slide.image.run", {"id": queued["id"]}, queued["id"])
        try:
            assert entered.wait(30)
            duplicate = saved(call, "slide.image.run", {"id": queued["id"]}, queued["id"])
            assert duplicate["state"] == "running"
            assert call("slide.image.abandon", {"id": queued["id"]}, "no-cost-ack")["error"]["code"] == "cost_acknowledgement_required"
            saved(call, "slide.image.abandon", {"id": queued["id"], "acknowledge_possible_cost": True})
        finally:
            release.set()
        finished = future.result(timeout=30)
    assert len(calls) == 1 and finished["state"] == "cancelled"
    assert finished["asset_id"] is None and len(finished["assets"]) == 1
    assert call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]["spent_micro_usd"] == 10000


def test_provider_failures_keep_estimate_and_changed_config_spends_nothing(image_workspace, monkeypatch):
    call, blueprint, adapter, errors, _ = image_workspace
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 50000})

    def fail(prompt, task_id):
        raise errors.DomainError("image_provider_failed", "scripted provider failure")

    monkeypatch.setattr(adapter, "generate", fail)
    params = {"id": blueprint["id"], "page_number": 1, "estimated_micro_usd": 20000, "allow_model_call": True}
    first = saved(call, "slide.image.reserve", params)
    failed = saved(call, "slide.image.run", {"id": first["id"]}, first["id"])
    assert failed["state"] == "failed" and failed["attempted"] == 1
    assert call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]["spent_micro_usd"] == 20000
    changed = saved(call, "slide.image.reserve", params)
    assert call("settings.update", {"semantic_llm_enabled": True})["ok"]
    refused = saved(call, "slide.image.run", {"id": changed["id"]}, changed["id"])
    assert refused["error_code"] == "image_configuration_changed" and refused["attempted"] == 0
    pending = saved(call, "slide.image.reserve", params)
    saved(call, "slide.image.abandon", {"id": pending["id"]})
    costs = call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]
    assert costs["spent_micro_usd"] == 20000 and costs["reserved_micro_usd"] == 0


def test_widescreen_padding_preserves_original_and_review_is_versioned(image_workspace, monkeypatch):
    from PIL import Image

    call, blueprint, adapter, _, generated = image_workspace
    original = generated.with_suffix('.png')
    with Image.new('RGB', (1536, 1024), '#2070A0') as image:
        image.putpixel((20, 20), (255, 0, 0))
        image.save(original)
    monkeypatch.setattr(adapter, "generate", lambda *args: (original, {"provider": "scripted", "model": "3:2-fixture"}))
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 50000})
    params = {"id": blueprint["id"], "page_number": 1, "estimated_micro_usd": 20000, "allow_model_call": True}
    job = saved(call, "slide.image.reserve", params)
    result = saved(call, "slide.image.run", {"id": job["id"]}, job["id"])
    assert result["state"] == "succeeded" and len(result["assets"]) == 2
    assets = {asset["id"]: asset for asset in result["assets"]}
    padded = assets[result["asset_id"]]
    raw = assets[padded["source_asset_id"]]
    assert Path(raw["stored_path"]).read_bytes() == original.read_bytes()
    assert padded["width"] * 9 == padded["height"] * 16
    processing = json.loads(padded["processing_json"])
    assert processing["scaled"] is False and processing["cropped"] is False
    with Image.open(padded["stored_path"]) as image:
        x, y = processing["offset"]
        assert image.getpixel((x + 20, y + 20)) == (255, 0, 0)
        assert image.crop((x, y, x + 1536, y + 1024)).tobytes() == Image.open(original).tobytes()
    assert call("slide.image.preview", {"id": padded["id"]})["data"]["mime_type"] == "image/jpeg"
    preview = call("slide.image.preview", {"id": padded["id"]})["data"]["content_base64"]
    assert base64.b64decode(preview).startswith(b'\xff\xd8')
    assert call("slide.image.file", {"id": raw["id"]})["data"]["stored_path"] == raw["stored_path"]
    cached = saved(call, "slide.image.reserve", {**params, "allow_model_call": False})
    assert len(cached["assets"]) == 2 and cached["state"] == "cached"
    review = {"id": padded["id"], "expected_version": 0, "decision": "rejected", "note": "fixture review finds wrong text"}
    assert tool("slide.image.review", review, "model-review", name="teacher_slides")["ok"] is False
    saved(call, "slide.image.review", review)
    assert call("slide.image.review", review, "stale-review")["error"]["code"] == "version_conflict"
    assert call("slide.image.reserve", {**params, "allow_model_call": False}, "reject-cache")["error"]["code"] == "model_call_not_authorized"
    approved = saved(call, "slide.image.review", {**review, "expected_version": 1, "decision": "approved", "note": "fixture corrected review"})
    assert approved["review_version"] == 2
    Path(padded["stored_path"]).write_bytes(b'corrupt')
    assert call("slide.image.file", {"id": padded["id"]})["error"]["code"] == "file_integrity_error"


def test_visual_text_check_reuses_layout_and_preserves_budget_claim(image_workspace, monkeypatch):
    call, blueprint, adapter, _, generated = image_workspace
    prefix = adapter.__package__
    analysis_api = importlib.import_module(prefix + ".image_analysis")
    layouts = importlib.import_module(prefix + ".slides")
    monkeypatch.setattr(adapter, "generate", lambda *args: (generated, {"provider": "fixture", "model": "image"}))
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 100000})
    job = saved(call, "slide.image.reserve", {"id": blueprint["id"], "page_number": 1, "estimated_micro_usd": 20000, "allow_model_call": True})
    image = saved(call, "slide.image.run", {"id": job["id"]}, job["id"])
    params = {"id": image["asset_id"], "estimated_micro_usd": 10000, "allow_model_call": True}
    assert call("slide.image.reserve_analysis", {**params, "allow_model_call": False}, "unapproved-vision")["error"]["code"] == "model_call_not_authorized"
    page = blueprint["content"]["pages"][0]
    visible = [page["title"], *page["key_messages"]]
    layout = layouts.SlideLayout.model_validate({"title": "fixture", "width": 1672, "height": 941,
        "elements": [{"kind": "text", "name": "observed", "text": "\n".join(visible), "x": 20, "y": 20, "width": 1500, "height": 800, "font_size": 32}]})
    calls = []

    def extract(ctx, path, **kwargs):
        calls.append((path, kwargs))
        return layout, {"provider": "fixture", "model": "vision", "cost_usd": 0.005}

    monkeypatch.setattr(analysis_api, "extract_layout", extract)
    pending = saved(call, "slide.image.reserve_analysis", params)
    assert saved(call, "slide.image.reserve_analysis", {**params, "allow_model_call": False})["id"] == pending["id"]
    result = saved(call, "slide.image.run", {"id": pending["id"]}, pending["id"])
    assert result["state"] == "succeeded", result
    assert result["analysis"]["text_check"] == "matched_extracted_text"
    assert result["analysis"]["layout"] == layout.model_dump()
    assert saved(call, "slide.image.reserve_analysis", {**params, "allow_model_call": False})["id"] == pending["id"]
    saved(call, "slide.image.run", {"id": pending["id"]}, pending["id"])
    assert len(calls) == 1
    layout.elements[0].text = "识别出错误文字"
    second = saved(call, "slide.image.reserve_analysis", {**params, "force_regenerate": True})
    mismatch = saved(call, "slide.image.run", {"id": second["id"]}, second["id"])
    assert mismatch["analysis"]["missing_text"] == visible
    assert mismatch["analysis"]["text_check"] == "needs_correction"
    costs = call("slide.image.budget", {"blueprint_id": blueprint["id"]})["data"]
    assert costs["spent_micro_usd"] == 30000 and costs["reserved_micro_usd"] == 0
