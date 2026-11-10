"""Documents are append-only revisions. A teacher reviews the precise saved version."""

import base64
import json
from pathlib import Path

from .database import audit, encode, new_id
from . import blueprints
from .blueprint_models import SlideBlueprint
from .document_models import DocumentSave, PlanContent, ScriptContent, timing_report
from .lessons import get_lesson
from .models import DomainError, Identifier


def get_document(conn, data):
    row = conn.execute("SELECT * FROM teaching_documents WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "教学文档不存在")
    result = dict(row)
    result["content"] = json.loads(result.pop("content_json"))
    if result["kind"] == "script":
        result["timing"] = timing_report(ScriptContent.model_validate(result["content"]))
    return result


def list_documents(conn, data):
    get_lesson(conn, Identifier(id=data.lesson_id))
    return {"items": [dict(row) for row in conn.execute(
        "SELECT id,lesson_id,kind,version,status,script_id,created_at FROM teaching_documents WHERE lesson_id=? ORDER BY kind,version DESC", (data.lesson_id,))]}


def save_document(conn, data, actor):
    lesson = get_lesson(conn, Identifier(id=data.lesson_id))
    generation = None
    if data.generation_id:
        from .preparation import get_generation
        generation = get_generation(conn, Identifier(id=data.generation_id))
        if generation["task"]["status"] != "running" or generation["lesson_id"] != data.lesson_id or generation["kind"] != data.kind or generation["expected_version"] != data.expected_version:
            raise DomainError("invalid_transition", "生成任务已结束、取消或与文档不匹配")
        if any(getattr(data, key) != value for key, value in generation["input_documents"].items()):
            raise DomainError("association_conflict", "生成结果需要关联任务启动时选定的教学文档版本")
    schema = {"script": ScriptContent, "lesson_plan": PlanContent, "slide_blueprint": SlideBlueprint}[data.kind]
    content = schema.model_validate(data.content)
    latest = conn.execute("SELECT id,version FROM teaching_documents WHERE lesson_id=? AND kind=? ORDER BY version DESC LIMIT 1", (data.lesson_id, data.kind)).fetchone()
    version = latest["version"] if latest else 0
    if data.expected_version != version:
        raise DomainError("version_conflict", "文档已有新版本，请刷新后修订")
    if data.kind == "script":
        if data.script_id or data.plan_id:
            raise DomainError("invalid_input", "授课稿无需关联其他授课稿")
        sources = {source["id"] for source in lesson["sources"]}
        if any(source not in sources for unit in content.units for segment in unit.segments for source in segment.source_ids):
            raise DomainError("association_conflict", "授课稿引用必须来自课次绑定的教材来源")
    else:
        script = get_document(conn, Identifier(id=data.script_id or "missing"))
        if script["lesson_id"] != data.lesson_id or script["kind"] != "script":
            raise DomainError("association_conflict", "教案需要关联本课次的授课稿版本")
        if data.kind == "lesson_plan":
            if data.plan_id:
                raise DomainError("invalid_input", "教案无需关联其他教案")
            expected = {(unit_index, segment_index) for unit_index, unit in enumerate(script["content"]["units"])
                        for segment_index in range(len(unit["segments"]))}
            actual = [(activity.unit_index, activity.segment_index) for activity in content.activities]
            if len(actual) != len(expected) or set(actual) != expected:
                raise DomainError("association_conflict", "教案活动必须逐一对应授课稿所有环节，避免重复或遗漏课时")
        else:
            plan = get_document(conn, Identifier(id=data.plan_id or "missing"))
            blueprints.validate_links(conn, content, lesson, script, plan)
    identifier = new_id()
    conn.execute("INSERT INTO teaching_documents(id,lesson_id,kind,version,parent_id,script_id,plan_id,content_json,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
                 (identifier, data.lesson_id, data.kind, version + 1, latest["id"] if latest else None, data.script_id, data.plan_id, encode(content.model_dump()), actor))
    result = get_document(conn, Identifier(id=identifier))
    if generation:
        conn.execute("UPDATE document_generations SET document_id=? WHERE workflow_id=?", (identifier, data.generation_id))
        conn.execute("UPDATE workflows SET status='awaiting_review',result_json=?,version=version+1 WHERE id=?", (encode({"document_id": identifier}), data.generation_id))
        conn.execute("INSERT INTO workflow_steps(workflow_id,step_key,result_json) VALUES(?,'document.saved',?)", (data.generation_id, encode({"document_id": identifier})))
    elif latest:
        pending = conn.execute("SELECT g.workflow_id FROM document_generations g JOIN workflows w ON w.id=g.workflow_id WHERE g.document_id=? AND w.status='awaiting_review'", (latest["id"],)).fetchall()
        for row in pending:
            conn.execute("UPDATE document_generations SET document_id=? WHERE workflow_id=?", (identifier, row[0]))
            conn.execute("UPDATE workflows SET result_json=?,version=version+1 WHERE id=?", (encode({"document_id": identifier}), row[0]))
            conn.execute("INSERT INTO workflow_steps(workflow_id,step_key,result_json) VALUES(?,?,?)", (row[0], f"document.revised-v{version + 1}", encode({"document_id": identifier})))
    audit(conn, "teaching_document", identifier, "save_version", actor, None, result)
    return result


def revise_segment(conn, data, actor):
    before = get_document(conn, Identifier(id=data.id))
    if before["kind"] != "script":
        raise DomainError("invalid_input", "分段修改只适用于授课稿")
    content = before["content"]
    segments = content["units"][data.unit_index]["segments"]
    if data.segment_index >= len(segments):
        raise DomainError("invalid_input", "指定的教学环节不存在")
    segments[data.segment_index] = data.segment.model_dump()
    return save_document(conn, DocumentSave(lesson_id=before["lesson_id"], kind="script", expected_version=before["version"], content=content), actor)


def review_document(conn, data, actor):
    before = get_document(conn, Identifier(id=data.id))
    if before["status"] != "draft":
        raise DomainError("invalid_transition", "已审核版本不能再次审核，请创建修订版")
    if data.decision == "approved":
        check = before
        if before["kind"] != "script":
            check = get_document(conn, Identifier(id=before["script_id"]))
            if check["status"] != "approved":
                raise DomainError("review_required", "请先审核教案关联的授课稿版本")
        if check["timing"]["warnings"]:
            raise DomainError("timing_review_failed", "授课稿时间或课堂环节检查未通过，请修订后审核")
    conn.execute("UPDATE teaching_documents SET status=?,reviewed_by=?,review_note=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                 (data.decision, actor, data.note, data.id))
    result = get_document(conn, Identifier(id=data.id))
    conn.execute("UPDATE workflows SET status=?,version=version+1 WHERE id IN (SELECT workflow_id FROM document_generations WHERE document_id=?) AND status='awaiting_review'",
                 ("completed" if data.decision == "approved" else "cancelled", data.id))
    audit(conn, "teaching_document", data.id, "review", actor, before, result)
    return result


def export_document(conn, data, actor):
    from .docx_export import build_docx
    from .files import store_bytes

    document = get_document(conn, data)
    if document["kind"] not in {"script", "lesson_plan"}:
        raise DomainError("unsupported_export", "页面蓝图属于课件内部数据，请通过课件中心生成设计图与PPTX")
    if document["status"] != "approved":
        raise DomainError("review_required", "正式DOCX导出需要教师审核通过该版本")
    previous = conn.execute("SELECT * FROM teaching_exports WHERE document_id=?", (data.id,)).fetchone()
    if previous:
        return dict(previous)
    lesson = get_lesson(conn, Identifier(id=document["lesson_id"]))
    script = get_document(conn, Identifier(id=document["script_id"])) if document["script_id"] else None
    content, template_hash = build_docx(document, lesson, script)
    path, digest = store_bytes(content, ".docx")
    identifier = new_id()
    filename = ("授课逐字稿" if document["kind"] == "script" else "正式教案") + f"-v{document['version']}.docx"
    conn.execute("INSERT INTO teaching_exports(id,document_id,stored_path,sha256,byte_size,filename,template_sha256) VALUES(?,?,?,?,?,?,?)",
                 (identifier, data.id, str(path), digest, len(content), filename, template_hash))
    result = dict(conn.execute("SELECT * FROM teaching_exports WHERE id=?", (identifier,)).fetchone())
    audit(conn, "teaching_document", data.id, "export_docx", actor, None, result)
    return result


def read_export(conn, data):
    import hashlib

    row = conn.execute("SELECT * FROM teaching_exports WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "导出文件不存在")
    content = Path(row["stored_path"]).read_bytes()
    if hashlib.sha256(content).hexdigest() != row["sha256"]:
        raise DomainError("file_integrity_error", "DOCX文件哈希校验失败")
    return {"filename": row["filename"], "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content_base64": base64.b64encode(content).decode("ascii"), "sha256": row["sha256"]}
