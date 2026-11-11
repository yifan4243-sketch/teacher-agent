"""Fit measured text through versioned page APIs and preserve earlier approvals."""

import importlib

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher
from tests.extensions.test_teacher_images import image_workspace
from tests.extensions.test_teacher_reconstruction import reconstruction_workspace
from tests.extensions.test_teacher_rendering import render_workspace

__all__ = ["image_workspace", "reconstruction_workspace", "render_workspace", "teacher"]


def measurement(name, *, row=None, column=None, width=100, height=50, content_width=200, content_height=100):
    return {"element_name": name, "row": row, "column": column, "frame_width": width, "frame_height": height,
            "content_width": content_width, "content_height": content_height, "font_size": 30}


def test_text_and_table_font_fit_uses_measured_bounds_and_readability_floor(render_workspace):
    module = importlib.import_module(render_workspace[3].__package__ + ".layout_repair")
    layout = {"width": 960, "elements": [{"kind": "text", "name": "title", "font_size": 100, "text": "fixture", "width": 100, "height": 50},
                           {"kind": "table", "name": "table", "font_size": 60, "rows": [["a"], ["b"]], "width": 116, "height": 100}]}
    observed = [measurement("title"), measurement("table", row=0, column=0, content_width=100, content_height=150),
                measurement("table", row=1, column=0, content_width=50, content_height=30)]
    fixed, report = module.fit_fonts(layout, observed, 32)
    assert layout["elements"][0]["font_size"] == 100 and layout["elements"][1]["font_size"] == 60
    assert fixed["elements"][0]["font_size"] == 48
    assert fixed["elements"][1]["font_size"] == 32
    assert len(report["changes"]) == 2 and report["minimum_limited"] == ["table"]
    assert report["missing_regions"] == 0
    _, incomplete = module.fit_fonts(layout, observed[:1], 32)
    assert incomplete["missing_regions"] == 2
    with pytest.raises(ValueError):
        module.TextMeasurement.model_validate({**observed[0], "content_height": float("nan")})

    expanded = [measurement("table", row=row, column=0, width=100, height=150, content_width=80, content_height=150) for row in range(2)]
    fixed, expanded_report = module.fit_fonts(layout, expanded, 8)
    assert len(expanded_report["overflows"]) == 2
    assert 19 <= fixed["elements"][1]["font_size"] <= 19.2


def test_render_based_repair_creates_draft_and_preserves_approved_source(render_workspace, monkeypatch):
    call, page, adapter, _, _, rendered = render_workspace
    saved(call, "slide.page.review", {"id": page["id"], "decision": "approved", "note": "fixture approved version"})
    observed = measurement("title", width=900, height=50, content_width=800, content_height=500)
    monkeypatch.setattr(adapter, "render", lambda *args: (rendered, {"version": "fixture", "measurements": [observed]}))
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    finished = saved(call, "slide.render.run", {"id": job["id"]}, job["id"])
    assert finished["comparison"]["text_bounds"]["overflow_regions"] == 1
    repaired = saved(call, "slide.page.fit_text", {"id": job["id"], "minimum_font_pixels": 32}, "fit-once")
    assert repaired["changed"] and repaired["page"]["version"] == 2
    assert repaired["page"]["status"] == "draft" and repaired["page"]["parent_id"] == page["id"]
    title = next(element for element in repaired["page"]["layout"]["elements"] if element["name"] == "title")
    assert title["font_size"] == 32
    assert repaired["page"]["repair"]["render_job_id"] == job["id"]
    assert call("slide.page.get", {"id": page["id"]})["data"]["status"] == "approved"
    assert saved(call, "slide.page.fit_text", {"id": job["id"], "minimum_font_pixels": 32}, "fit-once")["page"]["id"] == repaired["page"]["id"]
    assert call("slide.page.fit_text", {"id": job["id"]}, "stale-fit")["error"]["code"] == "version_conflict"
    assert call("slide.page.export", {"id": repaired["page"]["id"]}, "unreviewed-fit-export")["error"]["code"] == "review_required"


def test_older_render_without_measurements_keeps_preview_and_requests_new_measurement(render_workspace, monkeypatch):
    call, page, adapter, _, _, rendered = render_workspace
    monkeypatch.setattr(adapter, "render", lambda *args: (rendered, {"version": "legacy fixture"}))
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    assert saved(call, "slide.render.run", {"id": job["id"]}, job["id"])["state"] == "succeeded"
    assert call("slide.render.preview", {"id": job["id"]})["ok"]
    assert call("slide.page.fit_text", {"id": job["id"]}, "missing-measurement")["error"]["code"] == "text_measurement_required"
    assert call("slide.page.get", {"id": page["id"]})["data"]["repair"] is None
