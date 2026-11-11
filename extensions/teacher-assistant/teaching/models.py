"""Validation happens at tool, RPC and file boundaries."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Input(BaseModel):
    # Build nested validators on first use to keep native plugin registration fast.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, defer_build=True)


class Command(Input):
    operation: str = Field(min_length=1, max_length=80)
    data: dict = Field(default_factory=dict)
    request_id: str | None = Field(default=None, min_length=1, max_length=128)


class Identifier(Input):
    id: str = Field(min_length=1, max_length=64)


class ListRecords(Input):
    search: str = Field(default="", max_length=200)
    include_archived: bool = False


class CourseCreate(Input):
    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(default="", max_length=200)
    level: str = Field(default="", max_length=200)
    objectives: str = Field(default="", max_length=12000)
    period_minutes: int = Field(default=40, ge=1, le=240, strict=True)
    period_count: int = Field(default=2, ge=1, le=8, strict=True)
    break_minutes: int = Field(default=10, ge=0, le=120, strict=True)

    @model_validator(mode="after")
    def validate_break(self):
        if self.period_count == 1 and self.break_minutes:
            raise ValueError("单小节课程的课间分钟数应为0")
        return self


class CourseUpdate(Input):
    id: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1, strict=True)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    level: str | None = Field(default=None, max_length=200)
    objectives: str | None = Field(default=None, max_length=12000)
    period_minutes: int | None = Field(default=None, ge=1, le=240, strict=True)
    period_count: int | None = Field(default=None, ge=1, le=8, strict=True)
    break_minutes: int | None = Field(default=None, ge=0, le=120, strict=True)
    archived: bool | None = None


class ClassCreate(Input):
    name: str = Field(min_length=1, max_length=200)
    academic_year: str = Field(default="", max_length=100)


class ClassUpdate(Input):
    id: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1, strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    academic_year: str | None = Field(default=None, max_length=100)
    archived: bool | None = None


class StudentCreate(Input):
    student_number: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    class_id: str = Field(min_length=1, max_length=64)


class StudentUpdate(Input):
    id: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1, strict=True)
    student_number: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    class_id: str | None = Field(default=None, min_length=1, max_length=64)
    archived: bool | None = None


class CourseClass(Input):
    course_id: str = Field(min_length=1, max_length=64)
    class_id: str = Field(min_length=1, max_length=64)


class Enrollment(Input):
    course_id: str = Field(min_length=1, max_length=64)
    student_id: str = Field(min_length=1, max_length=64)


class CourseFilter(Input):
    course_id: str = Field(min_length=1, max_length=64)


class TaskCreate(Input):
    kind: Literal["course_setup"] = "course_setup"
    course: CourseCreate


class TaskChange(Identifier):
    version: int = Field(ge=1, strict=True)


class TaskReview(TaskChange):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=4000)


class ModelSelection(Input):
    provider: str = Field(min_length=1, max_length=200)
    model: str = Field(min_length=1, max_length=200)


class Policy(Input):
    agent_student_access: bool = Field(default=False, strict=True)
    semantic_llm_enabled: bool = Field(default=False, strict=True)
    disabled_operations: list[str] = Field(default_factory=list)
    stage_models: dict[Literal["teaching_script", "lesson_plan", "slides", "exams", "grading", "analysis"], ModelSelection] = Field(default_factory=dict)


class DomainError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
