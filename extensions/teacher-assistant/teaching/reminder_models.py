"""Reminder boundaries use explicit Beijing local times and optimistic versions."""

from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from .models import Identifier, Input


class ReminderSettings(Input):
    version: int = Field(ge=1, strict=True)
    enabled: bool = Field(strict=True)
    preclass_minutes: int | None = Field(default=15, ge=0, le=10080, strict=True)
    preparation_minutes: int | None = Field(default=1440, ge=0, le=10080, strict=True)
    exam_minutes: int | None = Field(default=60, ge=0, le=10080, strict=True)
    late_grace_minutes: int = Field(default=60, ge=0, le=10080, strict=True)


class TodoCreate(Input):
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(default="", max_length=4000)
    kind: Literal["homework", "exam", "preparation", "personal"] = "personal"
    course_id: str | None = Field(default=None, min_length=1, max_length=64)
    due_at: datetime
    lead_minutes: int = Field(default=15, ge=0, le=10080, strict=True)

    @field_validator("due_at")
    @classmethod
    def local_minute(cls, value):
        if value.tzinfo is not None or value.second or value.microsecond:
            raise ValueError("截止时间使用北京时间本地日期和整分钟")
        return value


class TodoUpdate(TodoCreate, Identifier):
    version: int = Field(ge=1, strict=True)
    status: Literal["pending", "completed", "cancelled"] = "pending"


class ReminderList(Input):
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=30, ge=1, le=100, strict=True)


class TodoList(ReminderList):
    status: Literal["pending", "completed", "cancelled"] | None = None


