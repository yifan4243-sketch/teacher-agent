"""Full teaching prose, explicit activity time, and immutable revision inputs."""

import re
from typing import Literal

from pydantic import Field, model_validator

from .models import Identifier, Input


class ScriptSegment(Input):
    title: str = Field(min_length=1, max_length=200)
    purpose: Literal["introduction", "explanation", "example", "question", "practice", "summary", "homework"]
    minutes: int = Field(ge=1, le=40, strict=True)
    spoken_text: str = Field(min_length=200, max_length=30000)
    activity_minutes: float = Field(default=0, ge=0, le=39, allow_inf_nan=False)
    teacher_actions: list[str] = Field(default_factory=list, max_length=20)
    student_activity: str = Field(default="", max_length=4000)
    blackboard: str = Field(default="", max_length=4000)
    source_ids: list[str] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def activity_fits(self):
        if self.activity_minutes >= self.minutes:
            raise ValueError("互动时间必须小于该环节总时间")
        if self.activity_minutes and not self.student_activity:
            raise ValueError("互动时间需要具体学生活动说明")
        return self


class ScriptUnit(Input):
    title: str = Field(min_length=1, max_length=200)
    segments: list[ScriptSegment] = Field(min_length=3, max_length=20)

    @model_validator(mode="after")
    def forty_minutes(self):
        if sum(segment.minutes for segment in self.segments) != 40:
            raise ValueError("每个教学单元的环节合计必须为40分钟")
        return self


class ScriptContent(Input):
    title: str = Field(min_length=1, max_length=200)
    speech_characters_per_minute: int = Field(default=220, ge=140, le=320, strict=True)
    units: list[ScriptUnit] = Field(min_length=2, max_length=2)
    homework: list[str] = Field(min_length=1, max_length=10)


class PlanActivity(Input):
    unit_index: int = Field(ge=0, le=1, strict=True)
    segment_index: int = Field(ge=0, le=19, strict=True)
    teacher_activity: str = Field(min_length=20, max_length=3000)
    student_activity: str = Field(min_length=1, max_length=2000)
    methods: str = Field(min_length=1, max_length=1000)


class PlanContent(Input):
    title: str = Field(min_length=1, max_length=200)
    objectives: str = Field(min_length=1, max_length=8000)
    key_points: str = Field(min_length=1, max_length=8000)
    difficulties: str = Field(min_length=1, max_length=8000)
    preparation: str = Field(min_length=1, max_length=6000)
    activities: list[PlanActivity] = Field(min_length=6, max_length=40)
    summary: str = Field(min_length=1, max_length=6000)
    values_education: str = Field(default="", max_length=6000)
    homework: str = Field(min_length=1, max_length=6000)
    blackboard: str = Field(min_length=1, max_length=6000)
    teaching_week: str = Field(default="待设置", max_length=100)
    session_number: int = Field(default=1, ge=1, le=1000, strict=True)
    lesson_numbers: str = Field(default="待设置", max_length=100)
    total_lessons: int | None = Field(default=None, ge=1, le=10000, strict=True)


class DocumentSave(Input):
    lesson_id: str = Field(min_length=1, max_length=64)
    kind: Literal["script", "lesson_plan"]
    expected_version: int = Field(default=0, ge=0, strict=True)
    content: dict
    script_id: str | None = Field(default=None, min_length=1, max_length=64)
    generation_id: str | None = Field(default=None, min_length=1, max_length=64)


class DocumentList(Input):
    lesson_id: str = Field(min_length=1, max_length=64)


class GenerationStart(DocumentList):
    kind: Literal["script", "lesson_plan"]
    allow_model_call: bool = Field(default=False, strict=True)


class GenerationClaim(Identifier):
    runtime_session_id: str = Field(min_length=1, max_length=200)
    stored_session_id: str = Field(min_length=1, max_length=200)


class DocumentReview(Identifier):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=4000)


class SegmentRevision(Identifier):
    unit_index: int = Field(ge=0, le=1, strict=True)
    segment_index: int = Field(ge=0, le=19, strict=True)
    segment: ScriptSegment


def timing_report(content):
    warnings = []
    totals = []
    purposes = set()
    has_actions = False
    has_board = False
    for unit_index, unit in enumerate(content.units, 1):
        estimates = []
        for segment in unit.segments:
            purposes.add(segment.purpose)
            has_actions |= bool(segment.teacher_actions)
            has_board |= bool(segment.blackboard)
            characters = len(re.sub(r"\s", "", segment.spoken_text))
            estimate = characters / content.speech_characters_per_minute + segment.activity_minutes
            estimates.append(estimate)
            if not 0.8 * segment.minutes <= estimate <= 1.25 * segment.minutes:
                warnings.append(f"第{unit_index}单元《{segment.title}》估算{estimate:.1f}分钟，与计划{segment.minutes}分钟不符")
        totals.append(round(sum(estimates), 2))
    required = {"introduction", "explanation", "example", "question", "practice", "summary", "homework"}
    missing = sorted(required - purposes)
    if missing:
        warnings.append("缺少课堂环节 " + "、".join(missing))
    if not has_actions or not has_board:
        warnings.append("需要教师动作和板书内容")
    return {"planned_units_minutes": [40, 40], "estimated_units_minutes": totals, "break_minutes": 10,
            "instruction_minutes": 80, "session_span_minutes": 90, "warnings": warnings,
            "method": "非空白字符数除以配置语速，加独立活动时间，属于估算，需教师试读核验"}
