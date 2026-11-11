"""Versioned exam specifications and exact question-version assembly contracts."""

from typing import Literal

from pydantic import Field, model_validator

from .models import Identifier, Input
from .question_models import QuestionKind


class TypeCount(Input):
    kind: QuestionKind
    count: int = Field(ge=1, le=200, strict=True)


class DifficultyCount(Input):
    difficulty: Literal["easy", "medium", "hard"]
    count: int = Field(ge=1, le=200, strict=True)


class ExamConfig(Input):
    chapter_ids: list[str] = Field(default_factory=list, max_length=200)
    knowledge_point_ids: list[str] = Field(default_factory=list, max_length=500)
    completed_only: bool = Field(default=False, strict=True)
    question_types: list[TypeCount] = Field(min_length=1, max_length=5)
    difficulties: list[DifficultyCount] = Field(default_factory=list, max_length=3)
    total_points_centi: int = Field(ge=1, le=1000000, strict=True)
    duration_minutes: int = Field(ge=1, le=360, strict=True)
    coverage_percent: int = Field(default=0, ge=0, le=100, strict=True)
    student_level: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def unique_and_consistent(self):
        for values in (self.chapter_ids, self.knowledge_point_ids, [item.kind for item in self.question_types], [item.difficulty for item in self.difficulties]):
            if len(values) != len(set(values)):
                raise ValueError("命题范围、题型和难度配置不能重复")
        count = sum(item.count for item in self.question_types)
        if count > 200 or self.difficulties and sum(item.count for item in self.difficulties) != count:
            raise ValueError("试卷最多200题，难度配置数量需与题型配置数量一致")
        return self


class ExamPlanSave(Input):
    course_id: str = Field(min_length=1, max_length=64)
    textbook_version_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    root_id: str | None = Field(default=None, min_length=1, max_length=64)
    expected_version: int = Field(default=0, ge=0, strict=True)
    config: ExamConfig


class ExamPaperSave(Input):
    plan_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    root_id: str | None = Field(default=None, min_length=1, max_length=64)
    expected_version: int = Field(default=0, ge=0, strict=True)
    generation_id: str | None = Field(default=None, min_length=1, max_length=64)
    question_ids: list[str] = Field(min_length=1, max_length=200)


class ExamList(Input):
    course_id: str = Field(min_length=1, max_length=64)
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=30, ge=1, le=100, strict=True)


class ExamGenerationStart(Identifier):
    allow_model_call: bool = Field(default=False, strict=True)


class ExamExport(Identifier):
    audience: Literal["student", "teacher"]
    format: Literal["docx", "pdf"]
