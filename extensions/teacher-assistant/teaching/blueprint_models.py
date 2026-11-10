"""Authoritative slide text and teaching links precede any generated design image."""

from typing import Literal

from pydantic import Field, model_validator

from .models import Identifier, Input


class ScriptReference(Input):
    unit_index: int = Field(ge=0, le=1, strict=True)
    segment_index: int = Field(ge=0, le=19, strict=True)


class SlideVisual(Input):
    kind: Literal["diagram", "flowchart", "comparison", "table", "chart", "illustration", "photo"]
    description: str = Field(min_length=1, max_length=3000)
    source_ids: list[str] = Field(default_factory=list, max_length=20)


class BlueprintPage(Input):
    number: int = Field(ge=1, le=80, strict=True)
    unit_index: int = Field(ge=0, le=1, strict=True)
    purpose: Literal["introduction", "concept", "comparison", "process", "example", "exercise", "summary"]
    title: str = Field(min_length=1, max_length=60)
    key_messages: list[str] = Field(min_length=1, max_length=5)
    source_ids: list[str] = Field(min_length=1, max_length=20)
    knowledge_point_ids: list[str] = Field(min_length=1, max_length=20)
    script_references: list[ScriptReference] = Field(min_length=1, max_length=10)
    duration_minutes: float = Field(gt=0, le=40, allow_inf_nan=False)
    visuals: list[SlideVisual] = Field(min_length=1, max_length=6)
    layout: Literal["single_column", "two_column", "three_column", "comparison", "timeline", "table"]
    teacher_notes: str = Field(min_length=1, max_length=6000)
    visual_requirements: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def projection_density(self):
        if any(not message.strip() or len(message) > 100 for message in self.key_messages):
            raise ValueError("页面核心信息每项需为1至100个字符")
        if sum(map(len, self.key_messages)) + len(self.title) > 320:
            raise ValueError("课堂投影页面文字过多，请拆页或精简可见文字")
        if any(reference.unit_index != self.unit_index for reference in self.script_references):
            raise ValueError("页面对应的授课稿环节需要属于同一教学单元")
        return self


class SlideBlueprint(Input):
    title: str = Field(min_length=1, max_length=200)
    theme: Literal["simple", "technology", "blue_white", "dark"] = "blue_white"
    pages: list[BlueprintPage] = Field(min_length=4, max_length=80)

    @model_validator(mode="after")
    def ordered_pages_and_teaching_time(self):
        if [page.number for page in self.pages] != list(range(1, len(self.pages) + 1)):
            raise ValueError("页面编号需要从1开始连续排列")
        if [page.unit_index for page in self.pages] != sorted(page.unit_index for page in self.pages):
            raise ValueError("页面需要按第一、第二教学单元顺序排列")
        for unit in (0, 1):
            if abs(sum(page.duration_minutes for page in self.pages if page.unit_index == unit) - 40) > 0.01:
                raise ValueError("每个教学单元的课件计划时间需要合计40分钟，休息单列")
        return self


class PageRequest(Identifier):
    page_number: int = Field(ge=1, le=80, strict=True)
