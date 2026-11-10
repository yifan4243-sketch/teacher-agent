"""Image-derived editable pages through the real plugin service and actual PPTX bytes."""

import hashlib
import importlib
import json
from pathlib import Path

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_images import image_workspace
from tests.extensions.test_teacher_slides import sample_layout

__all__ = ["image_workspace", "teacher"]


@pytest.fixture
def reconstruction_workspace(image_workspace, monkeypatch):
    call, blueprint, adapter, _, generated = image_workspace
    analysis = importlib.import_module(adapter.__package__ + ".image_analysis")
    layouts = importlib.import_module(adapter.__package__ + ".slides")
    monkeypatch.setattr(adapter, "generate", lambda *args: (generated, {"provider": "fixture", "model": "image"}))
    saved(call, "slide.image.set_budget", {"blueprint_id": blueprint["id"], "budget_micro_usd": 500000})

    def prepare(number, *, matching=False, approve_image=True):
        content = sample_layout()
        if matching:
            page = blueprint["content"]["pages"][number - 1]
            content["elements"].append({"kind": "text", "name": "blueprint-caption", "x": 30, "y": 880, "width": 1600, "height": 60,
                                        "font_size": 16, "text": "\n".join([page["title"], *page["key_messages"]])})
        monkeypatch.setattr(analysis, "extract_layout", lambda *args, **kwargs: (
            layouts.SlideLayout.model_validate(content), {"provider": "fixture", "model": "vision", "cost_usd": "0.001"}))
        queued = saved(call, "slide.image.reserve", {"id": blueprint["id"], "page_number": number, "estimated_micro_usd": 20000, "allow_model_call": True})
        image = saved(call, "slide.image.run", {"id": queued["id"]}, queued["id"])
        if approve_image:
            saved(call, "slide.image.review", {"id": image["asset_id"], "expected_version": 0, "decision": "approved", "note": "offline fixture for technical reconstruction"})
        pending = saved(call, "slide.image.reserve_analysis", {"id": image["asset_id"], "estimated_micro_usd": 1000, "allow_model_call": True})
        result = saved(call, "slide.image.run", {"id": pending["id"]}, pending["id"])
        return result, content

    return call, blueprint, prepare


def test_reviewed_native_pages_and_real_editable_pptx(reconstruction_workspace, tmp_path):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    call, blueprint, prepare = reconstruction_workspace
    analysis, content = prepare(1)
    page = saved(call, "slide.page.from_analysis", {"id": analysis["id"]})
    assert page["object_counts"] == {"text": 7, "shape": 19, "line": 5, "table": 1, "image": 0}
    assert call("slide.page.review", {"id": page["id"], "decision": "approved", "note": "wrong text"}, "reject-unmatched")["error"]["code"] == "slide_text_mismatch"
    draft = saved(call, "slide.page.preview_export", {"id": page["id"]})
    assert draft["filename"].startswith("预览草稿-")
    assert call("slide.page.export", {"id": page["id"]}, "unreviewed-export")["error"]["code"] == "review_required"
    source = blueprint["content"]["pages"][0]
    content["elements"].append({"kind": "text", "name": "corrected-blueprint-text", "x": 30, "y": 880, "width": 1600, "height": 60,
                                "font_size": 16, "text": "\n".join([source["title"], *source["key_messages"]])})
    revised = saved(call, "slide.page.revise", {"id": page["id"], "layout": content})
    assert revised["version"] == 2 and revised["text_check"]["missing_text"] == []
    assert call("slide.page.revise", {"id": page["id"], "layout": content}, "stale-edit")["error"]["code"] == "version_conflict"
    assert tool("slide.page.review", {"id": revised["id"], "decision": "approved", "note": "agent cannot approve"}, "agent-slide-review", name="teacher_slides")["ok"] is False
    saved(call, "slide.page.review", {"id": revised["id"], "decision": "approved", "note": "reviewed fixture objects"})
    output = saved(call, "slide.page.export", {"id": revised["id"]})
    assert saved(call, "slide.page.export", {"id": revised["id"]})["id"] == output["id"]
    assert hashlib.sha256(Path(output["stored_path"]).read_bytes()).hexdigest() == output["sha256"]
    presentation = Presentation(output["stored_path"])
    slide = presentation.slides[0]
    assert not any(shape.shape_type == MSO_SHAPE_TYPE.PICTURE for shape in slide.shapes)
    title = next(shape for shape in slide.shapes if shape.name == "title")
    circle = next(shape for shape in slide.shapes if shape.name == "target-left-outer")
    table = next(shape for shape in slide.shapes if shape.has_table).table
    title.text = "PPTX本机编辑后的标题"
    circle.left += 10000
    table.cell(1, 1).text = "本机编辑后的表格"
    edited = tmp_path / "real-edited.pptx"
    presentation.save(edited)
    reloaded = Presentation(edited).slides[0]
    assert next(shape for shape in reloaded.shapes if shape.name == "title").text == "PPTX本机编辑后的标题"
    assert next(shape for shape in reloaded.shapes if shape.has_table).table.cell(1, 1).text == "本机编辑后的表格"
    assert call("slide.deck.export", {"id": blueprint["id"]}, "incomplete-deck")["error"]["code"] == "incomplete_deck"


def test_complete_deck_retains_approved_versions_and_rejects_tampered_export(reconstruction_workspace):
    from pptx import Presentation

    call, blueprint, prepare = reconstruction_workspace
    approved = []
    for number in range(1, len(blueprint["content"]["pages"]) + 1):
        analysis, _ = prepare(number, matching=True)
        page = saved(call, "slide.page.from_analysis", {"id": analysis["id"]})
        approved.append(saved(call, "slide.page.review", {"id": page["id"], "decision": "approved", "note": "fixture review"}))
    deck = saved(call, "slide.deck.export", {"id": blueprint["id"]})
    assert len(Presentation(deck["stored_path"]).slides) == len(approved)
    assert [page["id"] for page in json.loads(deck["pages_json"])] == [page["id"] for page in approved]
    newer = saved(call, "slide.page.revise", {"id": approved[0]["id"], "layout": approved[0]["layout"]})
    latest = call("slide.page.list", {"blueprint_id": blueprint["id"], "limit": 100})["data"]
    assert latest["items"][0]["id"] == newer["id"] and latest["total"] == len(approved)
    history = call("slide.page.list", {"blueprint_id": blueprint["id"], "page_number": 1})["data"]
    assert history["total"] == 2
    assert saved(call, "slide.deck.export", {"id": blueprint["id"]})["id"] == deck["id"]
    assert call("slide.page.review", {"id": approved[0]["id"], "decision": "rejected", "note": "overwrite review"}, "overwrite-review")["error"]["code"] == "invalid_transition"
    Path(deck["stored_path"]).write_bytes(b"tampered")
    assert call("slide.deck.export", {"id": blueprint["id"]}, "damaged-export")["error"]["code"] == "file_integrity_error"


def test_image_review_and_layout_boundary_before_reconstruction(reconstruction_workspace):
    call, _, prepare = reconstruction_workspace
    analysis, _ = prepare(1, approve_image=False)
    assert call("slide.page.from_analysis", {"id": analysis["id"]}, "unreviewed-image")["error"]["code"] == "review_required"


def test_image_regions_export_as_independent_crops_and_reject_page_backgrounds(reconstruction_workspace, tmp_path):
    from io import BytesIO

    from PIL import Image
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    call, _, prepare = reconstruction_workspace
    analysis, layout = prepare(1, matching=True)
    page = saved(call, "slide.page.from_analysis", {"id": analysis["id"]})
    layout["elements"].append({"kind": "image", "name": "illustration-crop", "x": 1400, "y": 500, "width": 200, "height": 150,
        "source_x": 300, "source_y": 300, "source_width": 200, "source_height": 150, "description": "technical illustration crop fixture"})
    revised = saved(call, "slide.page.revise", {"id": page["id"], "layout": layout})
    assert revised["object_counts"]["image"] == 1
    saved(call, "slide.page.review", {"id": revised["id"], "decision": "approved", "note": "fixture crop reviewed"})
    exported = saved(call, "slide.page.export", {"id": revised["id"]})
    presentation = Presentation(exported["stored_path"])
    slide = presentation.slides[0]
    pictures = [shape for shape in slide.shapes if shape.shape_type == MSO_SHAPE_TYPE.PICTURE]
    assert len(pictures) == 1 and pictures[0].image.size == (200, 150)
    assert pictures[0]._element.nvPicPr.cNvPr.get("descr") == "technical illustration crop fixture"
    assert len(slide.shapes) == len(layout["elements"])
    assert any(shape.has_table for shape in slide.shapes)
    asset = call("slide.image.file", {"id": analysis["input_asset_id"]})["data"]
    with Image.open(asset["stored_path"]) as source, Image.open(BytesIO(pictures[0].image.blob)) as cropped:
        assert cropped.convert("RGBA").tobytes() == source.crop((300, 300, 500, 450)).convert("RGBA").tobytes()
    previous_x = pictures[0].left
    pictures[0].left += 50000
    edited = tmp_path / "picture-object-edited.pptx"
    presentation.save(edited)
    assert next(shape for shape in Presentation(edited).slides[0].shapes if shape.name == "illustration-crop").left == previous_x + 50000
    picture = layout["elements"][-1]
    picture.update(x=0, y=0, width=layout["width"], height=layout["height"])
    assert call("slide.page.revise", {"id": revised["id"], "layout": layout}, "full-page-bitmap")["error"]["code"] == "invalid_input"
    picture.update(x=1400, y=500, width=200, height=150, source_x=layout["width"] - 100)
    assert call("slide.page.revise", {"id": revised["id"], "layout": layout}, "crop-outside")["error"]["code"] == "invalid_input"
