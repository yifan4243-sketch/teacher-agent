"""Calendar publication and real teacher corrections require explicit intent and versions."""

from datetime import date, datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from .models import Identifier, Input


class PlanPublish(Identifier):
    replaces_publication_id: str | None = Field(default=None, min_length=1, max_length=64)
    review_note: str = Field(min_length=1, max_length=2000)


class CalendarRange(Input):
    start_date: date
    end_date: date
    course_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def bounded_range(self):
        if not 0 <= (self.end_date - self.start_date).days <= 369:
            raise ValueError("课表查询日期需有序且不超过370天")
        return self


class EventChange(Identifier):
    publication_id: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1, strict=True)
    note: str = Field(min_length=1, max_length=4000)


class EventMove(EventChange):
    starts_at: datetime

    @field_validator("starts_at")
    @classmethod
    def local_minute(cls, value):
        if value.tzinfo is not None or value.second or value.microsecond:
            raise ValueError("调课时间需为北京时间的本地日期和整分钟，不带时区后缀")
        return value


class ProgressRecord(EventChange):
    status: Literal["scheduled", "completed", "cancelled"]
    actual_minutes: int | None = Field(default=None, ge=0, le=1440, strict=True)
    lesson_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def completed_minutes(self):
        if (self.status == "completed") != (self.actual_minutes is not None):
            raise ValueError("已完成课次需填写实际教学或考核分钟，其他状态不能填写实际分钟")
        return self
