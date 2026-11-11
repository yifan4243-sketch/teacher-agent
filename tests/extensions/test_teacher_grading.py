"""Real local answers, deterministic scoring and atomic human-reviewed grade history."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import sqlite3

import pytest

from tests.extensions.test_teacher_documents import lesson_fixture
from tests.extensions.test_teacher_exams import exam_params
from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_questions import question_params

__all__ = ["teacher"]


@pytest.fixture
def assessment_workspace(teacher, tmp_path):
    home, _, call = teacher
    lesson, paper, student, answers = assessment_fixture(call, tmp_path)
    return home, call, lesson, paper, student, answers


def assessment_fixture(call, tmp_path):
    lesson = lesson_fixture(call, tmp_path)
    kinds = ("single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer")
    questions, answers = [], []
    responses = {"single_choice": {"selected_ids": ["A"]}, "multiple_choice": {"selected_ids": ["B", "A"]},
                 "true_false": {"answer": True}, "fill_blank": {"values": [" 自由度 ", "工作空间"]}, "short_answer": {"text": "自由度是独立运动的数量。"}}
    for kind in kinds:
        params = question_params(lesson, kind)
        params["content"]["prompt"] += " " + kind
        if kind == "fill_blank":
            params["content"].update(prompt="{{1}}描述独立运动的数量，{{2}}描述可达范围。", points_centi=501,
                                      blanks=[{"accepted": ["自由度"]}, {"accepted": ["工作空间"]}])
        question = saved(call, "question.save", params)
        saved(call, "question.review", {"id": question["id"], "decision": "approved"})
        questions.append(question)
        answers.append({"question_id": question["id"], "content": {"kind": kind, **responses[kind]}})
    params = exam_params(lesson, kinds)
    params["config"]["total_points_centi"] = 2501
    plan = saved(call, "exam.plan.save", params)
    paper = saved(call, "exam.paper.save", {"plan_id": plan["id"], "title": "虚构评分试卷", "question_ids": [item["id"] for item in questions]})
    saved(call, "exam.paper.review", {"id": paper["id"], "decision": "approved"})
    group = saved(call, "class.create", {"name": "虚构评分班级"})
    student = saved(call, "student.create", {"student_number": "GRADING-001", "name": "虚构评分学生", "class_id": group["id"]})
    saved(call, "course.assign_class", {"course_id": lesson["course_id"], "class_id": group["id"]})
    saved(call, "enrollment.create", {"course_id": lesson["course_id"], "student_id": student["id"]})
    return lesson, paper, student, answers


def review_payload(draft, subjective=400, current=None):
    scores = [{"question_id": score["question_id"], "points_centi": score["automatic_points_centi"], "rubric_awards": []}
              for score in draft["report"]["scores"] if score["kind"] != "short_answer"]
    item = next(score for score in draft["report"]["scores"] if score["kind"] == "short_answer")
    scores.append({"question_id": item["question_id"], "points_centi": subjective, "rubric_awards": [300, subjective - 300], "comment": "教师逐项核对评分细则"})
    return {"id": draft["id"], "scores": scores, "note": "虚构答卷复核记录", "confirmed": True, "expected_current_grade_id": current}


def test_objective_rules_and_integer_blank_distribution(assessment_workspace):
    _, call, _, paper, student, answers = assessment_workspace
    submission = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": answers})
    assert submission["answers"][3]["content"]["values"][0] == " 自由度 "
    draft = saved(call, "grading.score", {"id": submission["id"]})
    assert draft["report"]["objective_points_centi"] == 2001 and draft["report"]["subjective_count"] == 1
    updated = deepcopy(answers)
    updated[0]["content"]["selected_ids"] = []
    updated[1]["content"]["selected_ids"] = ["A"]
    updated[2]["content"]["answer"] = None
    updated[3]["content"]["values"] = ["自由度", "错误"]
    corrected = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": updated, "expected_version": 1})
    assert corrected["version"] == 2 and corrected["parent_id"] == submission["id"]
    scored = saved(call, "grading.score", {"id": corrected["id"]})
    assert scored["report"]["objective_points_centi"] == 251
    assert call("grading.score", {"id": submission["id"], "expected_version": 1}, "stale-submission")["error"]["code"] == "version_conflict"
    updated[3]["content"]["values"] = ["错误", "工作空间"]
    third = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": updated, "expected_version": 2})
    assert saved(call, "grading.score", {"id": third["id"]})["report"]["objective_points_centi"] == 250


def test_teacher_grade_publication_history_wrong_questions_and_concurrency(assessment_workspace):
    home, call, lesson, paper, student, answers = assessment_workspace
    submission = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": answers})
    draft = saved(call, "grading.score", {"id": submission["id"]})
    assert call("grade.list", {"course_id": lesson["course_id"]})["data"]["total"] == 0
    review = review_payload(draft)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda request: call("grading.publish", review, request), ["publish-a", "publish-b"]))
    assert sum(result["ok"] for result in results) == 1
    original = next(result["data"] for result in results if result["ok"])
    assert original["total_points_centi"] == 2401 and original["reviewed_by"] == "desktop:teacher"
    assert original["wrong_questions"] == [{"question_id": answers[-1]["question_id"], "lost_points_centi": 100}]
    assert call("grading.publish", {**review, "expected_current_grade_id": original["id"]}, "publish-duplicate")["error"]["code"] == "invalid_transition"
    newer = saved(call, "grading.score", {"id": submission["id"], "expected_version": 1})
    assert call("grading.publish", {**review, "expected_current_grade_id": original["id"]}, "stale-draft")["error"]["code"] == "version_conflict"
    correction = review_payload(newer, subjective=500, current=original["id"])
    correction["scores"][0].update(points_centi=250)
    assert call("grading.publish", correction, "missing-reason")["error"]["code"] == "review_note_required"
    correction["scores"][0]["comment"] = "教师按实际作答情况进行复核调整"
    revised = saved(call, "grading.publish", correction, "publish-correction")
    assert revised["total_points_centi"] == 2251 and revised["previous_id"] == original["id"]
    assert not call("grade.get", {"id": original["id"]})["data"]["active"]
    assert saved(call, "grading.publish", correction, "publish-correction")["id"] == revised["id"]
    assert call("grade.list", {"course_id": lesson["course_id"], "student_id": student["id"]})["data"]["items"][0]["id"] == revised["id"]
    with sqlite3.connect(home / "plugin-data/teacher-assistant/teaching.db") as conn:
        assert conn.execute("SELECT COUNT(*) FROM grade_publications").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM grade_publications WHERE active=1").fetchone()[0] == 1
        assert not conn.execute("PRAGMA foreign_key_check").fetchall()


def test_student_association_answer_validation_and_agent_privacy(assessment_workspace):
    _, call, lesson, paper, student, answers = assessment_workspace
    data = {"paper_id": paper["id"], "student_id": student["id"], "answers": answers}
    outsider = saved(call, "student.create", {"student_number": "UNENROLLED", "name": "未选课虚构学生", "class_id": student["class_id"]})
    assert call("submission.save", {**data, "student_id": outsider["id"]}, "unassociated")["error"]["code"] == "association_conflict"
    for changed in (answers[:-1], [answers[0]] * len(answers)):
        assert call("submission.save", {**data, "answers": changed}, "invalid-" + str(len(changed)))["error"]["code"] == "invalid_answers"
    for kind, update in ((0, {"selected_ids": ["H"]}), (0, {"selected_ids": ["A", "B"]}), (3, {"values": ["自由度"]})):
        bad = deepcopy(answers)
        bad[kind]["content"].update(update)
        assert call("submission.save", {**data, "answers": bad}, "bad-answer-" + str(update))["error"]["code"] == "invalid_answers"
    submission = saved(call, "submission.save", data)
    for operation in ("submission.get", "submission.list", "grading.score", "grading.draft.get", "grading.publish", "grade.get", "grade.list"):
        assert not tool(operation, {"id": submission["id"]}, "agent-" + operation, name="teacher_assessment")["ok"]
    draft = saved(call, "grading.score", {"id": submission["id"]})
    invalid = review_payload(draft)
    invalid["scores"][-1]["rubric_awards"] = [400, 0]
    assert call("grading.publish", invalid, "bad-rubric")["error"]["code"] == "invalid_scores"
    saved(call, "student.update", {"id": student["id"], "version": student["version"], "archived": True})
    assert call("grading.publish", review_payload(draft), "archived-student")["error"]["code"] == "archived"
    assert call("grade.list", {"course_id": lesson["course_id"]})["data"]["total"] == 0


def test_native_subjective_assistance_consent_bounds_and_human_publication(assessment_workspace):
    _, call, lesson, paper, student, answers = assessment_workspace
    submission = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": answers})
    draft = saved(call, "grading.score", {"id": submission["id"]})
    assert call("grading.generation.begin", {"id": draft["id"]}, "unconsented")["error"]["code"] == "model_call_not_authorized"
    generation = saved(call, "grading.generation.begin", {"id": draft["id"], "allow_model_call": True})
    assert not tool("grading.context", {"id": generation["workflow_id"]}, name="teacher_assessment")["ok"]
    saved(call, "grading.generation.claim", {"id": generation["workflow_id"], "runtime_session_id": "teacher-foundation", "stored_session_id": "grading-stored"})
    from model_tools import handle_function_call
    denied = json.loads(handle_function_call("teacher_assessment", {"operation": "grading.context", "data": {"id": generation["workflow_id"]}}, task_id="different-native-session", enabled_toolsets=["teacher"]))
    assert not denied["ok"] and denied["error"]["code"] == "permission_denied"
    context = tool("grading.context", {"id": generation["workflow_id"]}, name="teacher_assessment")
    assert context["ok"] and len(context["data"]["items"]) == 1
    assert "虚构评分学生" not in json.dumps(context) and "GRADING-001" not in json.dumps(context)
    assert context["data"]["items"][0]["student_text"] == answers[-1]["content"]["text"]
    score = {"question_id": answers[-1]["question_id"], "points_centi": 400, "rubric_awards": [300, 100], "comment": "第二要点说明不完整，请教师核对", "confidence": 0.4}
    bad = {**score, "points_centi": 700, "rubric_awards": [300, 400]}
    assert not tool("grading.assist.save", {"id": generation["workflow_id"], "scores": [bad]}, "invalid-assistance", name="teacher_assessment")["ok"]
    malformed = tool("grading.assist.save", {"id": generation["workflow_id"], "scores": [{**score, "confidence": True}]}, "boolean-confidence", name="teacher_assessment")
    assert not malformed["ok"] and malformed["error"]["code"] == "invalid_input"
    result = tool("grading.assist.save", {"id": generation["workflow_id"], "scores": [score]}, "save-assistance", name="teacher_assessment")
    assert result["ok"] and result["data"]["status"] == "awaiting_review"
    proposed = call("grading.draft.get", {"id": result["data"]["draft_id"]})["data"]
    assert proposed["report"]["scores"][-1]["confidence"] == 0.4
    assert proposed["report"]["objective_points_centi"] == 2001
    assert call("grade.list", {"course_id": lesson["course_id"]})["data"]["total"] == 0
    official = saved(call, "grading.publish", review_payload(proposed))
    assert official["total_points_centi"] == 2401
    assert call("grading.generation.get", {"id": generation["workflow_id"]})["data"]["task"]["status"] == "completed"


def test_cancelled_assistance_and_stale_drafts_cannot_save(assessment_workspace):
    _, call, _, paper, student, answers = assessment_workspace
    submission = saved(call, "submission.save", {"paper_id": paper["id"], "student_id": student["id"], "answers": answers})
    draft = saved(call, "grading.score", {"id": submission["id"]})
    score = {"question_id": answers[-1]["question_id"], "points_centi": 500, "rubric_awards": [300, 200], "comment": "符合评分细则", "confidence": 0.9}
    for cancelled in (False, True):
        generation = saved(call, "grading.generation.begin", {"id": draft["id"], "allow_model_call": True})
        claimed = saved(call, "grading.generation.claim", {"id": generation["workflow_id"], "runtime_session_id": "teacher-foundation", "stored_session_id": "stored"})
        if cancelled:
            saved(call, "task.cancel", {"id": generation["workflow_id"], "version": claimed["task"]["version"]})
        else:
            draft = saved(call, "grading.score", {"id": submission["id"], "expected_version": draft["version"]})
        denied = tool("grading.assist.save", {"id": generation["workflow_id"], "scores": [score]}, "late-" + str(cancelled), name="teacher_assessment")
        assert not denied["ok"] and denied["error"]["code"] == ("invalid_transition" if cancelled else "version_conflict")
