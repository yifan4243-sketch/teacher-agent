"""Typed local answers and explicit teacher publication of rubric-level scores."""

from typing import Annotated, Literal

from pydantic import ConfigDict, Field

from .models import Identifier, Input


class AnswerInput(Input):
    model_config = ConfigDict(str_strip_whitespace=False)


class ChoiceAnswer(AnswerInput):
    kind: Literal["single_choice", "multiple_choice"]
    selected_ids: list[str] = Field(max_length=8)


class BooleanAnswer(AnswerInput):
    kind: Literal["true_false"]
    answer: bool | None = Field(default=None, strict=True)


class BlankResponse(AnswerInput):
    kind: Literal["fill_blank"]
    values: list[str] = Field(max_length=20)


class WrittenAnswer(AnswerInput):
    kind: Literal["short_answer"]
    text: str = Field(max_length=20000)


AnswerContent = Annotated[ChoiceAnswer | BooleanAnswer | BlankResponse | WrittenAnswer, Field(discriminator="kind")]


class AnswerItem(Input):
    question_id: str = Field(min_length=1, max_length=64)
    content: AnswerContent


class SubmissionSave(Input):
    paper_id: str = Field(min_length=1, max_length=64)
    student_id: str = Field(min_length=1, max_length=64)
    expected_version: int = Field(default=0, ge=0, strict=True)
    answers: list[AnswerItem] = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=4000)


class SubmissionList(Identifier):
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=30, ge=1, le=100, strict=True)


class GradeScore(Identifier):
    expected_version: int = Field(default=0, ge=0, strict=True)


class ReviewedScore(Input):
    question_id: str = Field(min_length=1, max_length=64)
    points_centi: int = Field(ge=0, le=100000, strict=True)
    rubric_awards: list[Annotated[int, Field(ge=0, le=100000, strict=True)]] = Field(default_factory=list, max_length=30)
    comment: str = Field(default="", max_length=4000)


class GradeReview(Identifier):
    expected_current_grade_id: str | None = Field(default=None, min_length=1, max_length=64)
    scores: list[ReviewedScore] = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=4000)
    confirmed: Literal[True]


class AssistedScore(ReviewedScore):
    comment: str = Field(min_length=1, max_length=4000)
    confidence: float = Field(ge=0, le=1, strict=True)


class GradeAssistSave(Identifier):
    scores: list[AssistedScore] = Field(min_length=1, max_length=200)


class GradeList(Input):
    course_id: str = Field(min_length=1, max_length=64)
    student_id: str | None = Field(default=None, min_length=1, max_length=64)
    paper_id: str | None = Field(default=None, min_length=1, max_length=64)
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=30, ge=1, le=100, strict=True)
