"""Explicit semester dates, local weekly slots and textbook chapter difficulty weights."""

from datetime import date
from typing import Literal

from pydantic import Field, model_validator

from .models import Input


class WeeklySlot(Input):
    weekday: int = Field(ge=0, le=6, strict=True)
    start_time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")


class ChapterWeight(Input):
    chapter_id: str = Field(min_length=1, max_length=64)
    difficulty: int = Field(default=1, ge=1, le=10, strict=True)


class SessionContent(Input):
    kind: Literal["teaching", "practice", "review", "exam"]
    chapter_id: str | None = Field(default=None, min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def chapter_for_teaching(self):
        if (self.kind == "teaching") != (self.chapter_id is not None):
            raise ValueError("教学课次需关联教材章节，练习、复习和考核的章节关联留空")
        return self


class PlanSave(Input):
    course_id: str = Field(min_length=1, max_length=64)
    textbook_version_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    weekly_slots: list[WeeklySlot] = Field(min_length=1, max_length=30)
    excluded_dates: list[date] = Field(default_factory=list, max_length=370)
    chapters: list[ChapterWeight] = Field(default_factory=list, max_length=500)
    practice_sessions: int = Field(default=0, ge=0, le=100, strict=True)
    review_sessions: int = Field(default=0, ge=0, le=100, strict=True)
    exam_sessions: int = Field(default=0, ge=0, le=20, strict=True)
    exam_minutes: int = Field(default=90, ge=1, le=480, strict=True)
    parent_id: str | None = Field(default=None, min_length=1, max_length=64)
    session_content: list[SessionContent] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def bounded_calendar(self):
        if not 0 <= (self.end_date - self.start_date).days <= 369:
            raise ValueError("学期日期需有序且不超过370天")
        keys = [(slot.weekday, slot.start_time) for slot in self.weekly_slots]
        if len(keys) != len(set(keys)):
            raise ValueError("每周授课时段不能重复")
        if any(day < self.start_date or day > self.end_date for day in self.excluded_dates):
            raise ValueError("停课日期需位于本学期范围")
        identifiers = [item.chapter_id for item in self.chapters]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("计划章节不能重复")
        return self
