"""Deterministic objective scoring and bounds shared by teacher and model proposals."""

import unicodedata

from .models import DomainError


def _normalize(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def _choice(question, answer):
    return question["points_centi"] if set(question["answer_ids"]) == set(answer["selected_ids"]) else 0


def _boolean(question, answer):
    return question["points_centi"] if question["answer"] is answer["answer"] else 0


def _blanks(question, answer):
    base, remainder = divmod(question["points_centi"], len(question["blanks"]))
    return sum(base + (index < remainder) for index, (blank, value) in enumerate(zip(question["blanks"], answer["values"]))
               if _normalize(value) in {_normalize(accepted) for accepted in blank["accepted"]})


OBJECTIVE = {"single_choice": _choice, "multiple_choice": _choice, "true_false": _boolean, "fill_blank": _blanks}


def score(paper, submission):
    answers = {item["question_id"]: item["content"] for item in submission["answers"]}
    scores = []
    for question in paper["questions"]:
        content = question["content"]
        points = OBJECTIVE[content["kind"]](content, answers[question["id"]]) if content["kind"] in OBJECTIVE else None
        scores.append({"question_id": question["id"], "kind": content["kind"], "max_points_centi": content["points_centi"],
            "automatic_points_centi": points, "proposed_points_centi": points, "rubric_awards": [], "comment": "",
            "confidence": None, "method": "deterministic" if points is not None else "awaiting_teacher"})
    return {"scores": scores, "objective_points_centi": sum(item["automatic_points_centi"] or 0 for item in scores),
            "subjective_count": sum(item["automatic_points_centi"] is None for item in scores)}


def validate_scores(paper, scores, *, subjective_only=False):
    expected = {question["id"]: question["content"] for question in paper["questions"] if not subjective_only or question["kind"] == "short_answer"}
    if len(scores) != len(expected) or {item.question_id for item in scores} != set(expected):
        raise DomainError("invalid_scores", "评分需要逐一对应指定试卷中的题目版本")
    for item in scores:
        question = expected[item.question_id]
        if item.points_centi > question["points_centi"]:
            raise DomainError("invalid_scores", "题目得分不能超过该题分值")
        if question["kind"] == "short_answer":
            limits = [entry["points_centi"] for entry in question["rubric"]]
            if len(item.rubric_awards) != len(limits) or any(type(value) is not int or value < 0 or value > limit for value, limit in zip(item.rubric_awards, limits)) or sum(item.rubric_awards) != item.points_centi:
                raise DomainError("invalid_scores", "简答题需逐项填写Rubric得分，各项得分在上限内且合计等于题目得分")
        elif item.rubric_awards:
            raise DomainError("invalid_scores", "客观题评分使用题目得分")
