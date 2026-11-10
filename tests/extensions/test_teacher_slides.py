"""Native-object exports and the vision adapter use actual image and PPTX files."""

import importlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from tests.extensions.test_teacher_foundation import teacher

__all__ = ["teacher"]


def slide_module(manager):
    return importlib.import_module(manager._plugins["teacher-assistant"].module.__name__ + ".teaching.slides")


def sample_layout():
    path = Path(__file__).resolve().parents[2] / "extensions/teacher-assistant/resources/slide-prototype/layout.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_native_text_geometry_and_table_really_remain_editable(teacher, tmp_path):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    _, manager, _ = teacher
    api = slide_module(manager)
    original = api.export_pptx([sample_layout()], tmp_path / "reconstructed.pptx")
    presentation = Presentation(original)
    slide = presentation.slides[0]
    assert not any(shape.shape_type == MSO_SHAPE_TYPE.PICTURE for shape in slide.shapes)
    title = next(shape for shape in slide.shapes if shape.name == "title")
    circle = next(shape for shape in slide.shapes if shape.name == "target-left-outer")
    table = next(shape for shape in slide.shapes if shape.has_table).table
    assert title.text == "定位精度与重复定位精度"
    assert table.cell(1, 1).text == "离目标有多近"
    old_x = circle.left
    title.text = "测试修改后的标题"
    circle.left += 91440
    table.cell(1, 1).text = "测试修改后的单元格"
    edited = tmp_path / "edited.pptx"
    presentation.save(edited)
    reread = Presentation(edited).slides[0]
    assert next(shape for shape in reread.shapes if shape.name == "title").text == "测试修改后的标题"
    assert next(shape for shape in reread.shapes if shape.name == "target-left-outer").left == old_x + 91440
    assert next(shape for shape in reread.shapes if shape.has_table).table.cell(1, 1).text == "测试修改后的单元格"
    with pytest.raises(FileExistsError):
        api.export_pptx([sample_layout()], original)


def test_vision_adapter_requires_authorization_and_validates_layout(teacher):
    from agent.plugin_llm import PluginLlmStructuredResult

    _, manager, _ = teacher
    prefix = manager._plugins["teacher-assistant"].module.__name__
    vision = importlib.import_module(prefix + ".teaching.slide_vision")
    errors = importlib.import_module(prefix + ".teaching.models")
    source = Path(__file__).resolve().parents[2] / "extensions/teacher-assistant/resources/slide-prototype/generated-design.jpg"
    invocations = []

    def complete(**kwargs):
        invocations.append(kwargs)
        return PluginLlmStructuredResult("", "test", "scripted-vision", "test", parsed=sample_layout(), content_type="json")

    ctx = SimpleNamespace(llm=SimpleNamespace(complete_structured=complete))
    with pytest.raises(errors.DomainError, match="授权"):
        vision.extract_layout(ctx, source)
    assert invocations == []
    layout, usage = vision.extract_layout(ctx, source, allow_model_call=True)
    assert layout.elements and usage["model"] == "scripted-vision"
    assert invocations[0]["input"][0]["data"] == source.read_bytes()
    bad = sample_layout()
    bad["elements"][0]["x"] = bad["width"]
    with pytest.raises(ValueError, match="画布"):
        slide_module(manager).SlideLayout.model_validate(bad)
