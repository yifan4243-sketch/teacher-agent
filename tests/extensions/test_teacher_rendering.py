"""Rendering jobs use actual image/PPTX artifacts with a substituted Office process boundary."""

from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import importlib
from pathlib import Path
from threading import Event

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_images import image_workspace
from tests.extensions.test_teacher_reconstruction import reconstruction_workspace

__all__ = ["image_workspace", "reconstruction_workspace", "teacher"]


@pytest.fixture
def render_workspace(reconstruction_workspace, image_workspace, monkeypatch):
    call, _, prepare = reconstruction_workspace
    analysis, _ = prepare(1, matching=True)
    page = saved(call, "slide.page.from_analysis", {"id": analysis["id"]})
    adapter = importlib.import_module(image_workspace[2].__package__ + ".office_render")
    module = importlib.import_module(image_workspace[2].__package__ + ".rendering")
    errors = image_workspace[3]
    monkeypatch.setattr(adapter, "powershell_command", lambda: ("fixture-office",))
    source = Path(__file__).resolve().parents[2] / "extensions/teacher-assistant/phase5-evidence/image-regions/before.png"
    return call, page, adapter, module, errors, source.read_bytes()


def test_pixel_difference_reports_actual_metrics(render_workspace):
    from PIL import Image

    _, _, _, module, _, _ = render_workspace
    white = BytesIO()
    black = BytesIO()
    Image.new("RGB", (16, 9), "white").save(white, format="PNG")
    Image.new("RGB", (16, 9), "black").save(black, format="PNG")
    _, equal = module.compare(white.getvalue(), white.getvalue())
    assert equal["mean_absolute_rgb_error"] == 0 and equal["pixels_above_32_fraction"] == 0
    difference, opposite = module.compare(white.getvalue(), black.getvalue())
    assert opposite["mean_absolute_rgb_error"] == 255 and opposite["pixels_above_32_fraction"] == 1
    with Image.open(BytesIO(difference)) as image:
        assert image.getpixel((0, 0)) == (255, 255, 255)


def test_render_claim_concurrency_preview_and_corrupt_file(render_workspace, monkeypatch):
    call, page, adapter, _, _, rendered = render_workspace
    started, release = Event(), Event()
    calls = []

    def render(path, work, renderer):
        assert path.read_bytes().startswith(b"PK")
        calls.append(renderer)
        started.set()
        assert release.wait(30)
        return rendered, {"version": "fixture-office"}

    monkeypatch.setattr(adapter, "render", render)
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    assert saved(call, "slide.render.begin", {"id": page["id"]})["id"] == job["id"]
    assert tool("slide.render.begin", {"id": page["id"]}, "agent-render-begin", name="teacher_slides")["ok"] is False
    with ThreadPoolExecutor(max_workers=2) as executor:
        result = executor.submit(saved, call, "slide.render.run", {"id": job["id"]}, job["id"])
        try:
            assert started.wait(30)
            assert saved(call, "slide.render.run", {"id": job["id"]}, job["id"])["state"] == "running"
            assert call("course.list")["ok"]
        finally:
            release.set()
        finished = result.result(timeout=30)
    assert finished["state"] == "succeeded" and calls == ["wps"]
    assert Path(finished["stored_path"]).read_bytes() == rendered
    assert 0 <= finished["comparison"]["mean_absolute_rgb_error"] <= 255
    assert 0 <= finished["comparison"]["pixels_above_32_fraction"] <= 1
    assert finished["comparison"]["reference_sha256"]
    assert saved(call, "slide.render.run", {"id": job["id"]}, job["id"])["state"] == "succeeded"
    assert calls == ["wps"]
    assert call("slide.render.preview", {"id": job["id"]})["data"]["mime_type"] == "image/jpeg"
    assert call("slide.render.file", {"id": job["id"], "variant": "difference"})["data"]["filename"].endswith(".png")
    Path(finished["stored_path"]).write_bytes(b"corrupted render")
    assert call("slide.render.preview", {"id": job["id"]})["error"]["code"] == "file_integrity_error"


def test_office_failure_is_durable_and_new_task_recovers(render_workspace, monkeypatch):
    call, page, adapter, _, errors, rendered = render_workspace
    calls = []

    def fail(*args):
        calls.append("failed")
        raise errors.DomainError("office_unavailable", "fixture Office unavailable")

    monkeypatch.setattr(adapter, "render", fail)
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    failed = saved(call, "slide.render.run", {"id": job["id"]}, job["id"])
    assert failed["state"] == "failed" and failed["error_code"] == "office_unavailable"
    saved(call, "slide.render.run", {"id": job["id"]}, job["id"])
    assert len(calls) == 1
    monkeypatch.setattr(adapter, "render", lambda *args: (rendered, {"version": "fixture-office"}))
    next_job = saved(call, "slide.render.begin", {"id": page["id"]})
    assert next_job["id"] != job["id"]
    assert saved(call, "slide.render.run", {"id": next_job["id"]}, next_job["id"])["state"] == "succeeded"
    listed = call("slide.render.list", {"id": page["id"], "limit": 1})["data"]
    assert listed["total"] == 2 and listed["next_offset"] == 1
