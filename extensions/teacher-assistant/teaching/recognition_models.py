"""Answer-page extraction and explicit correction retain their source jobs."""

from typing import Annotated

from pydantic import ConfigDict, Field

from .grading_models import AnswerItem, SubmissionSave
from .models import Identifier, Input


class AnswerUpload(Input):
    paper_id: str = Field(min_length=1, max_length=64)
    student_id: str = Field(min_length=1, max_length=64)
    filename: str = Field(min_length=1, max_length=200)
    total_bytes: int = Field(ge=1, le=50 * 1024 * 1024, strict=True)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class AnswerFileList(Identifier):
    student_id: str | None = Field(default=None, min_length=1, max_length=64)
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=20, ge=1, le=100, strict=True)


class AnswerPage(Identifier):
    page_number: int = Field(ge=1, le=200, strict=True)


class RecognitionBudget(Identifier):
    budget_micro_usd: int = Field(ge=0, le=1_000_000_000_000, strict=True)


class RecognitionReserve(Identifier):
    pages: list[Annotated[int, Field(ge=1, le=200, strict=True)]] = Field(min_length=1, max_length=200)
    estimated_micro_usd: int = Field(ge=1, le=1_000_000_000, strict=True)
    allow_model_call: bool = Field(default=False, strict=True)
    force_regenerate: bool = Field(default=False, strict=True)


class RecognizedAnswer(AnswerItem):
    model_config = ConfigDict(str_strip_whitespace=False)
    observed_text: str = Field(max_length=20000)
    confidence: float = Field(ge=0, le=1, strict=True)
    note: str = Field(default="", max_length=2000)


class AnswerExtraction(Input):
    model_config = ConfigDict(str_strip_whitespace=False)
    answers: list[RecognizedAnswer] = Field(max_length=200)
    unassigned_text: str = Field(default="", max_length=20000)
    note: str = Field(default="", max_length=4000)


class RecognitionSelection(Identifier):
    job_ids: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(min_length=1, max_length=200)


class RecognitionApply(SubmissionSave):
    file_id: str = Field(min_length=1, max_length=64)
    job_ids: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(min_length=1, max_length=200)
    reviewed_uncertain: bool = Field(default=False, strict=True)
