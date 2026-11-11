"""Native question drafts, typed answer invariants, citations and immutable review history."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json

from tests.extensions.test_teacher_documents import lesson_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool

__all__ = ["teacher"]


def question_params(lesson, kind="single_choice"):
    content = {"kind": kind, "prompt": "工业机器人关节可独立运动的数量称为什么？", "explanation": "依据教材，自由度描述独立运动的数量。",
        "points_centi": 500, "difficulty": "medium", "source_ids": [lesson["sources"][0]["id"]]}
    answers = {
        "single_choice": {"options": [{"id": "A", "text": "自由度"}, {"id": "B", "text": "工作载荷"}], "answer_ids": ["A"]},
        "multiple_choice": {"options": [{"id": "A", "text": "自由度"}, {"id": "B", "text": "工作空间"}, {"id": "C", "text": "颜色"}], "answer_ids": ["A", "B"]},
        "true_false": {"answer": True},
        "fill_blank": {"prompt": "机器人可独立运动的数量称为{{1}}。", "blanks": [{"accepted": ["自由度", "机器人自由度"]}]},
        "short_answer": {"reference_answer": "自由度用于描述机器人独立运动的数量。", "rubric": [{"label": "说明独立运动", "points_centi": 300}, {"label": "说明数量", "points_centi": 200}]},
    }
    return {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "content": {**content, **answers[kind]}}


def test_question_native_tool_review_versions_and_concurrent_revision(teacher, tmp_path):
    from tools.skills_tool import skill_view

    _, _, call = teacher
    loaded = json.loads(skill_view("teacher-assistant:teacher-assessment"))
    assert loaded["success"] and "question.save" in loaded["content"]
    schema = tool("question.schema", name="teacher_assessment")
    assert schema["ok"] and schema["data"]["properties"]["content"]["discriminator"]["propertyName"] == "kind"
    lesson = lesson_fixture(call, tmp_path)
    params = question_params(lesson)
    created = tool("question.save", params, "question-once", name="teacher_assessment")
    assert created["ok"], created
    question = created["data"]
    assert tool("question.save", params, "question-once", name="teacher_assessment")["data"]["id"] == question["id"]
    assert question["status"] == "draft" and question["sources"][0]["id"] == lesson["sources"][0]["id"]
    assert question["sources"][0]["locator"] == lesson["sources"][0]["locator"]
    denied = tool("question.review", {"id": question["id"], "decision": "approved", "note": "model cannot self-approve"}, "question-agent-review", name="teacher_assessment")
    assert not denied["ok"]
    approved = saved(call, "question.review", {"id": question["id"], "decision": "approved", "note": "教师核对实际教材、答案与解析"})
    assert approved["reviewed_by"] == "desktop:teacher" and approved["reviewed_at"]
    updated = {**params, "root_id": question["root_id"], "expected_version": 1,
        "content": {**params["content"], "prompt": "修订后的自由度测试题目"}}
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda request: call("question.save", updated, request), ["revise-a", "revise-b"]))
    assert sum(result["ok"] for result in results) == 1
    assert next(result for result in results if not result["ok"])["error"]["code"] == "version_conflict"
    versions = call("question.list", {"course_id": lesson["course_id"], "root_id": question["root_id"]})["data"]["items"]
    assert {item["version"] for item in versions} == {1, 2}
    assert call("question.get", {"id": question["id"]})["data"]["status"] == "approved"
    assert call("question.list", {"course_id": lesson["course_id"], "status": "approved"})["data"]["items"][0]["id"] == question["id"]
    assert call("question.get", {"id": question["id"]})["data"]["content"] == params["content"] | {"knowledge_point_ids": []}
    assert call("question.review", {"id": question["id"], "decision": "rejected", "note": "不能覆盖审核历史"}, "repeat-question-review")["error"]["code"] == "invalid_transition"


def test_supported_question_types_answers_and_rubric_validation(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    for kind in ("single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer"):
        question = saved(call, "question.save", question_params(lesson, kind))
        assert question["kind"] == kind and question["points_centi"] == 500
    invalid = []
    single = question_params(lesson)
    single["content"]["answer_ids"] = ["A", "B"]
    invalid.append(single)
    choice = question_params(lesson, "multiple_choice")
    choice["content"]["answer_ids"] = ["H"]
    invalid.append(choice)
    blank = question_params(lesson, "fill_blank")
    blank["content"]["prompt"] = "没有对应填空位置"
    invalid.append(blank)
    subjective = question_params(lesson, "short_answer")
    subjective["content"]["rubric"][0]["points_centi"] = 301
    invalid.append(subjective)
    boolean = question_params(lesson, "true_false")
    boolean["content"]["answer"] = "true"
    invalid.append(boolean)
    for index, params in enumerate(invalid):
        assert call("question.save", params, f"invalid-answer-{index}")["error"]["code"] == "invalid_input"
    assert call("question.list", {"course_id": lesson["course_id"]})["data"]["total"] == 5


def test_question_source_associations_duplicate_detection_and_pagination(teacher, tmp_path):
    _, _, call = teacher
    lesson = lesson_fixture(call, tmp_path)
    params = question_params(lesson)
    first = saved(call, "question.save", params)
    duplicate = deepcopy(params)
    duplicate["content"]["prompt"] = "　工 业机器人关节可独立运动的数量称为什么？　"
    second = saved(call, "question.save", duplicate)
    assert second["duplicates"][0]["id"] == first["id"]
    assert call("question.get", {"id": first["id"]})["data"]["duplicates"][0]["id"] == second["id"]
    course = saved(call, "course.create", {"title": "其他课程"})
    assert call("question.save", {**params, "course_id": course["id"]}, "question-wrong-course")["error"]["code"] == "association_conflict"
    unknown = deepcopy(params)
    unknown["content"]["knowledge_point_ids"] = ["fabricated-point"]
    assert call("question.save", unknown, "question-fabricated-point")["error"]["code"] == "association_conflict"
    points = call("knowledge.list", {"version_id": lesson["version_id"]})["data"]["items"]
    supported = next(point for point in points if point["source_id"] in params["content"]["source_ids"])
    linked = deepcopy(params)
    linked["content"]["knowledge_point_ids"] = [supported["id"]]
    linked["content"]["prompt"] = "有效知识点来源的另一个题目"
    saved(call, "question.save", linked)
    page = call("question.list", {"course_id": lesson["course_id"], "limit": 2})["data"]
    assert len(page["items"]) == 2 and page["next_offset"] == 2 and page["total"] == 3
    assert len(call("question.list", {"course_id": lesson["course_id"], "offset": 2, "limit": 2})["data"]["items"]) == 1
    chapters = call("textbook.version", {"id": lesson["version_id"]})["data"]["chapters"]
    root = next(chapter for chapter in chapters if chapter["parent_id"] is None)
    assert call("question.list", {"course_id": lesson["course_id"], "chapter_id": root["id"]})["data"]["total"] == 3
    assert call("question.list", {"course_id": lesson["course_id"], "chapter_id": "other-chapter"})["data"]["total"] == 0
    old_book = call("textbook.version", {"id": lesson["version_id"]})["data"]
    updated_path = tmp_path / "新版题目教材.txt"
    updated_path.write_text("第一章 基本知识\n1.1 技术参数\n自由度描述独立运动的数量。新版补充了参数选择说明。\n", encoding="utf-8")
    edition = saved(call, "textbook.import", {"course_id": lesson["course_id"], "textbook_id": old_book["textbook_id"], "title": "文档测试教材", "path": str(updated_path)})
    source = call("knowledge.search", {"course_id": lesson["course_id"], "version_id": edition["id"], "query": "自由度"})["data"]["items"][0]
    revision = saved(call, "question.save", {**params, "root_id": first["root_id"], "expected_version": 1, "textbook_version_id": edition["id"],
        "content": {**params["content"], "source_ids": [source["id"]]}})
    assert revision["version"] == 2 and revision["sources"][0]["version_id"] == edition["id"]
    assert call("question.list", {"course_id": lesson["course_id"], "textbook_version_id": lesson["version_id"], "chapter_id": root["id"]})["data"]["total"] == 3
    reviewed = saved(call, "question.review", {"id": first["id"], "decision": "approved", "note": "独立核对原教材版本的旧草稿"})
    assert reviewed["status"] == "approved" and reviewed["textbook_version_id"] == lesson["version_id"]
    rejected = saved(call, "question.review", {"id": revision["id"], "decision": "rejected"})
    assert rejected["status"] == "rejected" and rejected["review_note"] == "" and rejected["reviewed_by"] == "desktop:teacher"
