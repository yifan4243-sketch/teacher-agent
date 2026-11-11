"""Typed answer contracts shared by question authoring and subsequent scoring."""

import re
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .models import Identifier, Input


QuestionKind = Literal["single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer"]


class QuestionBase(Input):
    prompt: str = Field(min_length=1, max_length=6000)
    explanation: str = Field(min_length=1, max_length=12000)
    points_centi: int = Field(ge=1, le=100000, strict=True)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    source_ids: list[str] = Field(min_length=1, max_length=30)
    knowledge_point_ids: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def unique_references(self):
        if len(self.source_ids) != len(set(self.source_ids)) or len(self.knowledge_point_ids) != len(set(self.knowledge_point_ids)):
            raise ValueError("教材来源和知识点引用不能重复")
        return self


class ChoiceOption(Input):
    id: str = Field(pattern=r"^[A-H]$")
    text: str = Field(min_length=1, max_length=3000)


class ChoiceQuestion(QuestionBase):
    kind: Literal["single_choice", "multiple_choice"]
    options: list[ChoiceOption] = Field(min_length=2, max_length=8)
    answer_ids: list[str] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def choices_and_answer(self):
        identifiers = [option.id for option in self.options]
        if len(identifiers) != len(set(identifiers)) or len(self.answer_ids) != len(set(self.answer_ids)) or not set(self.answer_ids) <= set(identifiers):
            raise ValueError("选择题选项标识和答案需唯一，答案需属于实际选项")
        if self.kind == "single_choice" and len(self.answer_ids) != 1:
            raise ValueError("单选题需要唯一标准答案")
        if len({option.text for option in self.options}) != len(self.options):
            raise ValueError("选择题选项正文不能重复")
        return self


class TrueFalseQuestion(QuestionBase):
    kind: Literal["true_false"]
    answer: bool = Field(strict=True)


class BlankAnswer(Input):
    accepted: list[str] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def valid_answers(self):
        if any(not answer.strip() or len(answer) > 2000 for answer in self.accepted) or len(self.accepted) != len(set(self.accepted)):
            raise ValueError("填空题的可接受答案需非空且不重复，每项不超过2000字符")
        return self


class FillBlankQuestion(QuestionBase):
    kind: Literal["fill_blank"]
    blanks: list[BlankAnswer] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def placeholders(self):
        placeholders = re.findall(r"\{\{([0-9]+)\}\}", self.prompt)
        if sorted(placeholders, key=int) != [str(number) for number in range(1, len(self.blanks) + 1)]:
            raise ValueError("填空题正文需用{{1}}、{{2}}等连续标识对应每个空的答案")
        return self


class RubricItem(Input):
    label: str = Field(min_length=1, max_length=3000)
    points_centi: int = Field(ge=1, le=100000, strict=True)


class ShortAnswerQuestion(QuestionBase):
    kind: Literal["short_answer"]
    reference_answer: str = Field(min_length=1, max_length=12000)
    rubric: list[RubricItem] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def rubric_total(self):
        if sum(item.points_centi for item in self.rubric) != self.points_centi:
            raise ValueError("简答题评分细则的分值合计需等于题目总分")
        return self


QuestionContent = Annotated[ChoiceQuestion | TrueFalseQuestion | FillBlankQuestion | ShortAnswerQuestion, Field(discriminator="kind")]


class QuestionSave(Input):
    course_id: str = Field(min_length=1, max_length=64)
    textbook_version_id: str = Field(min_length=1, max_length=64)
    root_id: str | None = Field(default=None, min_length=1, max_length=64)
    expected_version: int = Field(default=0, ge=0, strict=True)
    content: QuestionContent


class QuestionReview(Identifier):
    decision: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=4000)


class QuestionList(Input):
    course_id: str = Field(min_length=1, max_length=64)
    textbook_version_id: str | None = Field(default=None, min_length=1, max_length=64)
    root_id: str | None = Field(default=None, min_length=1, max_length=64)
    chapter_id: str | None = Field(default=None, min_length=1, max_length=64)
    kind: QuestionKind | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    status: Literal["draft", "approved", "rejected"] | None = None
    search: str = Field(default="", max_length=200)
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=30, ge=1, le=100, strict=True)
