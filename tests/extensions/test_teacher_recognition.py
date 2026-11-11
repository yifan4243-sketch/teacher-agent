"""Actual PDF/image pages and persistence with scripted vision responses and teacher review."""

import base64
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import hashlib
from io import BytesIO
import json
from pathlib import Path
from threading import Event

import pytest

from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_grading import assessment_workspace, review_payload

__all__ = ["assessment_workspace", "teacher"]


def answer_image():
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGB", (900, 1200), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=32)
    draw.multiline_text((50, 60), "Synthetic answer fixture\n1. A\n2. A, B\n3. True\n4. degree of freedom\n5. Independent motion count", font=font, fill="black", spacing=25)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def scanned_pdf():
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen.canvas import Canvas

    output = BytesIO()
    canvas = Canvas(output, pagesize=(450, 600))
    for _ in range(2):
        canvas.drawImage(ImageReader(BytesIO(answer_image())), 0, 0, width=450, height=600)
        canvas.showPage()
    canvas.save()
    return output.getvalue()


def upload_answer(call, paper, student, *, content=None, filename="虚构答卷.png"):
    content = answer_image() if content is None else content
    params = {"paper_id": paper["id"], "student_id": student["id"], "filename": filename,
              "total_bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    upload = saved(call, "answer.upload.begin", params)
    chunk = {"id": upload["id"], "offset": 0, "content_base64": base64.b64encode(content).decode()}
    saved(call, "answer.upload.chunk", chunk)
    assert saved(call, "answer.upload.chunk", chunk)["bytes_received"] == len(content)
    return saved(call, "answer.upload.finish", {"id": upload["id"]})


@pytest.fixture
def vision(assessment_workspace, monkeypatch):
    from agent.plugin_llm import PluginLlm, PluginLlmStructuredResult, PluginLlmUsage

    answers = assessment_workspace[-1]
    state = {"calls": [], "cost": 0.001, "error": None, "entered": None, "release": None,
        "result": {"answers": [{**deepcopy(answer), "observed_text": "scripted transcription", "confidence": 0.95, "note": ""} for answer in answers], "unassigned_text": "", "note": "scripted vision fixture"}}
    state["result"]["answers"][-1]["confidence"] = 0.4
    def complete(self, **kwargs):
        state["calls"].append(kwargs)
        if state["entered"]:
            state["entered"].set()
        if state["release"]:
            assert state["release"].wait(60)
        if state["error"]:
            raise state["error"]
        return PluginLlmStructuredResult("", "test", "scripted-recognition", "test", usage=PluginLlmUsage(cost_usd=state["cost"]), parsed=deepcopy(state["result"]), content_type="json")
    monkeypatch.setattr(PluginLlm, "complete_structured", complete)
    return state


def reserve(call, file, *, pages=None, force=False):
    saved(call, "recognition.set_budget", {"id": file["id"], "budget_micro_usd": 10000})
    return saved(call, "recognition.reserve", {"id": file["id"], "pages": pages or [1], "estimated_micro_usd": 1000,
        "allow_model_call": True, "force_regenerate": force})["items"]


def test_answer_files_scanned_pdf_preview_and_upload_validation(assessment_workspace):
    _, call, _, paper, student, _ = assessment_workspace
    file = upload_answer(call, paper, student, content=scanned_pdf(), filename="虚构扫描答卷.pdf")
    assert file["page_count"] == 2 and file["mime_type"] == "application/pdf"
    preview = saved(call, "answer.file.preview", {"id": file["id"], "page_number": 2})
    assert base64.b64decode(preview["content_base64"]).startswith(b"\x89PNG")
    assert (preview["width"], preview["height"]) == (1350, 1800)
    assert saved(call, "answer.file.preview", {"id": file["id"], "page_number": 2})["source_sha256"] == preview["source_sha256"]
    assert call("answer.file.preview", {"id": file["id"], "page_number": 3}, "bad-page")["error"]["code"] == "invalid_page"
    assert call("answer.file.list", {"id": paper["id"], "student_id": student["id"]})["data"]["total"] == 1
    assert not tool("answer.file.get", {"id": file["id"]}, name="teacher_assessment")["ok"]
    params = {"paper_id": paper["id"], "student_id": student["id"], "filename": "wrong.pdf", "total_bytes": 8, "sha256": hashlib.sha256(b"bad file").hexdigest()}
    upload = saved(call, "answer.upload.begin", params)
    assert call("answer.upload.finish", {"id": upload["id"]}, "incomplete")["error"]["code"] == "incomplete_upload"
    saved(call, "answer.upload.chunk", {"id": upload["id"], "offset": 0, "content_base64": base64.b64encode(b"bad file").decode()})
    assert call("answer.upload.finish", {"id": upload["id"]}, "invalid-pdf")["error"]["code"] == "invalid_answer_file"


def test_authorized_recognition_replay_budget_and_low_confidence_review(assessment_workspace, vision):
    from docx import Document
    from pypdf import PdfReader

    _, call, lesson, paper, student, answers = assessment_workspace
    file = upload_answer(call, paper, student)
    params = {"id": file["id"], "pages": [1], "estimated_micro_usd": 1000}
    assert call("recognition.reserve", params, "no-consent")["error"]["code"] == "model_call_not_authorized"
    assert call("recognition.reserve", {**params, "allow_model_call": True}, "no-budget")["error"]["code"] == "budget_exceeded"
    assert not vision["calls"]
    job = reserve(call, file)[0]
    assert saved(call, "recognition.reserve", params)["items"][0]["id"] == job["id"]
    finished = saved(call, "recognition.run", {"id": job["id"]}, job["id"])
    assert finished["state"] == "succeeded", finished
    assert saved(call, "recognition.run", {"id": job["id"]}, job["id"])["id"] == job["id"] and len(vision["calls"]) == 1
    payload = json.loads(vision["calls"][0]["input"][0]["text"])
    assert "answer_ids" not in json.dumps(payload) and "reference_answer" not in json.dumps(payload)
    assert student["name"] not in json.dumps(payload) and vision["calls"][0]["input"][1]["data"].startswith(b"\x89PNG")
    proposal = call("recognition.compose", {"id": file["id"], "job_ids": [job["id"]]})["data"]
    assert proposal["review_required"] and len(proposal["warnings"]) == 1
    apply = {"paper_id": paper["id"], "student_id": student["id"], "file_id": file["id"], "job_ids": [job["id"]], "answers": answers}
    assert call("recognition.apply", apply, "unreviewed")["error"]["code"] == "recognition_review_required"
    assert call("submission.list", {"id": paper["id"]})["data"]["total"] == 0
    submission = saved(call, "recognition.apply", {**apply, "reviewed_uncertain": True})
    assert submission["recognition_sources"][0]["job_id"] == job["id"] and submission["recognition_sources"][0]["reviewed_uncertain"] == 1
    draft = saved(call, "grading.score", {"id": submission["id"]})
    grade = saved(call, "grading.publish", review_payload(draft))
    assert grade["total_points_centi"] == 2401
    assert call("grade.list", {"course_id": lesson["course_id"]})["data"]["total"] == 1
    for format_ in ("docx", "pdf"):
        exported = saved(call, "grade.export", {"id": grade["id"], "format": format_})
        path = exported["stored_path"]
        text = "\n".join(item.text for item in Document(path).paragraphs) if format_ == "docx" else "\n".join(page.extract_text() for page in PdfReader(path).pages)
        compact = "".join(text.split())
        assert file["filename"] in compact and file["sha256"] in compact and "第1页" in compact
    costs = call("recognition.budget", {"id": file["id"]})["data"]
    assert costs["spent_micro_usd"] == 1000 and costs["reserved_micro_usd"] == 0
    refreshed = call("recognition.compose", {"id": file["id"], "job_ids": [job["id"]]})["data"]
    assert refreshed["expected_version"] == 1
    corrected = saved(call, "recognition.apply", {**apply, "reviewed_uncertain": True, "expected_version": refreshed["expected_version"]})
    assert corrected["version"] == 2 and corrected["recognition_sources"][0]["job_id"] == job["id"]
    assert call("recognition.apply", {**apply, "reviewed_uncertain": True}, "stale-transcription")["error"]["code"] == "version_conflict"


def test_running_recognition_releases_database_lock_and_cancellation_retains_cost(assessment_workspace, vision):
    _, call, _, paper, student, _ = assessment_workspace
    file = upload_answer(call, paper, student)
    job = reserve(call, file)[0]
    entered, release = Event(), Event()
    vision.update(entered=entered, release=release, cost=0.003)
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(saved, call, "recognition.run", {"id": job["id"]}, job["id"])
        try:
            assert entered.wait(60)
            saved(call, "todo.create", {"title": "识别执行时仍可保存本地待办", "due_at": "2026-11-12T08:00:00"})
            assert call("recognition.cancel", {"id": job["id"]}, "unacknowledged-cancel")["error"]["code"] == "cost_acknowledgement_required"
            saved(call, "recognition.cancel", {"id": job["id"], "acknowledge_possible_cost": True})
        finally:
            release.set()
        finished = future.result(timeout=60)
    assert finished["state"] == "cancelled" and finished["reported_micro_usd"] == 3000
    assert call("recognition.budget", {"id": file["id"]})["data"]["spent_micro_usd"] == 3000
    assert saved(call, "recognition.run", {"id": job["id"]}, job["id"])["state"] == "cancelled" and len(vision["calls"]) == 1
    assert call("recognition.compose", {"id": file["id"], "job_ids": [job["id"]]})["error"]["code"] == "association_conflict"


def test_invalid_model_response_and_denied_provider_preserve_budget_facts(assessment_workspace, vision):
    from agent.plugin_llm import PluginLlmTrustError

    _, call, _, paper, student, _ = assessment_workspace
    file = upload_answer(call, paper, student)
    job = reserve(call, file)[0]
    vision["result"]["answers"][0]["question_id"] = "fabricated"
    vision["cost"] = 0.002
    finished = saved(call, "recognition.run", {"id": job["id"]}, job["id"])
    assert finished["state"] == "failed" and finished["error_code"] == "invalid_model_response"
    assert finished["reported_micro_usd"] == 2000
    denied_job = reserve(call, file, force=True)[0]
    vision["error"] = PluginLlmTrustError("not authorized")
    denied = saved(call, "recognition.run", {"id": denied_job["id"]}, denied_job["id"])
    assert denied["state"] == "failed" and denied["attempted"] == 0 and denied["error_code"] == "model_permission_denied"
    assert call("recognition.budget", {"id": file["id"]})["data"]["spent_micro_usd"] == 2000


def test_multiple_pages_merge_uncertainty_and_scope(assessment_workspace, vision):
    _, call, _, paper, student, answers = assessment_workspace
    file = upload_answer(call, paper, student, content=scanned_pdf(), filename="多页扫描.pdf")
    jobs = reserve(call, file, pages=[1, 2])
    for index, job in enumerate(jobs):
        vision["result"]["answers"] = [{"question_id": answers[-1]["question_id"], "content": {"kind": "short_answer", "text": f"第{index + 1}页的作答片段"}, "observed_text": "笔迹", "confidence": 0.95}]
        saved(call, "recognition.run", {"id": job["id"]}, job["id"])
    selected = {"id": file["id"], "job_ids": [job["id"] for job in reversed(jobs)]}
    merged = call("recognition.compose", selected)["data"]
    assert merged["answers"][-1]["content"]["text"] == "第1页的作答片段\n第2页的作答片段" and merged["review_required"]
    assert len(merged["warnings"]) == 5
    duplicate = reserve(call, file, pages=[1], force=True)[0]
    saved(call, "recognition.run", {"id": duplicate["id"]}, duplicate["id"])
    assert call("recognition.compose", {"id": file["id"], "job_ids": [jobs[0]["id"], duplicate["id"]]})["error"]["code"] == "invalid_selection"
    other = upload_answer(call, paper, student)
    assert call("recognition.compose", {"id": other["id"], "job_ids": [jobs[0]["id"]]})["error"]["code"] == "association_conflict"


def test_corrupt_page_stops_before_a_billable_attempt(assessment_workspace, vision):
    _, call, _, paper, student, _ = assessment_workspace
    file = upload_answer(call, paper, student)
    preview = saved(call, "answer.file.preview", {"id": file["id"], "page_number": 1})
    page_path = Path(file["stored_path"]).with_name(preview["source_sha256"] + ".png")
    page_path.write_bytes(b"damaged answer page")
    job = reserve(call, file)[0]
    finished = saved(call, "recognition.run", {"id": job["id"]}, job["id"])
    assert finished["state"] == "failed" and finished["attempted"] == 0 and finished["error_code"] == "file_integrity_error"
    assert not vision["calls"] and call("recognition.budget", {"id": file["id"]})["data"]["spent_micro_usd"] == 0


def test_default_model_change_requires_a_new_reservation(assessment_workspace, vision):
    import hermes_yaml as yaml

    home, call, _, paper, student, _ = assessment_workspace
    file = upload_answer(call, paper, student)
    job = reserve(call, file)[0]
    path = home / "config.yaml"
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    config["model"] = {"default": "changed-vision-model", "provider": "test"}
    path.write_text(yaml.safe_dump(config), encoding="utf-8")
    assert call("recognition.run", {"id": job["id"]}, job["id"])["error"]["code"] == "model_settings_changed"
    assert not vision["calls"] and call("recognition.get", {"id": job["id"]})["data"]["attempted"] == 0
    replacement = reserve(call, file)[0]
    assert replacement["id"] != job["id"]
    saved(call, "recognition.cancel", {"id": job["id"]})
    finished = saved(call, "recognition.run", {"id": replacement["id"]}, replacement["id"])
    assert finished["state"] == "succeeded" and len(vision["calls"]) == 1
