"""One dispatch boundary for native tools and the authenticated Desktop RPC."""

from functools import partial
import hashlib
import json
import sqlite3

from pydantic import ValidationError

from . import blueprint_models, blueprints, document_models, documents, image_analysis, image_assets, image_models, images, knowledge, knowledge_models, lessons, models, preparation, reconstruction, records, rendering, semantic, workflows
from .database import database, encode


READS = {
    "course.list": (models.ListRecords, partial(records.list_records, entity="course")),
    "class.list": (models.ListRecords, partial(records.list_records, entity="class")),
    "student.list": (models.ListRecords, partial(records.list_records, entity="student")),
    "enrollment.list": (models.CourseFilter, records.list_enrollments),
    "course.classes": (models.CourseFilter, records.list_course_classes),
    "textbook.list": (models.CourseFilter, knowledge.list_books),
    "textbook.get": (models.Identifier, knowledge.get_book),
    "textbook.version": (models.Identifier, knowledge.get_version),
    "source.get": (models.Identifier, knowledge.get_source),
    "source.list": (knowledge_models.VersionFilter, knowledge.list_sources),
    "knowledge.list": (knowledge_models.VersionFilter, knowledge.list_knowledge),
    "knowledge.search": (knowledge_models.SourceSearch, knowledge.search_sources),
    "lesson.get": (models.Identifier, lessons.get_lesson),
    "lesson.list": (models.CourseFilter, lessons.list_lessons),
    "document.get": (models.Identifier, documents.get_document),
    "document.list": (document_models.DocumentList, documents.list_documents),
    "document.schema": (models.Input, preparation.content_schema),
    "preparation.context": (models.Identifier, preparation.context),
    "document.generation.get": (models.Identifier, preparation.get_generation),
    "document.generation.list": (document_models.DocumentList, preparation.list_generations),
    "slide.prompt": (blueprint_models.PageRequest, blueprints.get_prompt),
    "slide.themes": (models.Input, blueprints.list_themes),
    "slide.image.get": (models.Identifier, images.get_job),
    "slide.image.list": (image_models.ImageList, images.list_jobs),
    "slide.image.budget": (image_models.BlueprintFilter, images.budget),
    "slide.page.get": (models.Identifier, reconstruction.get_page),
    "slide.page.list": (reconstruction.PageList, reconstruction.list_pages),
    "slide.render.get": (models.Identifier, rendering.get_job),
    "slide.render.list": (rendering.RenderList, rendering.list_jobs),
}
WRITES = {
    "course.create": (models.CourseCreate, partial(records.create_record, entity="course")),
    "course.update": (models.CourseUpdate, partial(records.update_record, entity="course")),
    "class.create": (models.ClassCreate, partial(records.create_record, entity="class")),
    "class.update": (models.ClassUpdate, partial(records.update_record, entity="class")),
    "student.create": (models.StudentCreate, partial(records.create_record, entity="student")),
    "student.update": (models.StudentUpdate, partial(records.update_record, entity="student")),
    "course.assign_class": (models.CourseClass, records.assign_class),
    "enrollment.create": (models.Enrollment, records.enroll),
    "task.create": (models.TaskCreate, workflows.create_task),
    "task.run": (models.Identifier, workflows.run_task),
    "task.cancel": (models.TaskChange, partial(workflows.change_task, target="cancelled")),
    "task.retry": (models.TaskChange, partial(workflows.change_task, target="pending")),
    "textbook.import": (knowledge_models.ImportBook, knowledge.import_book),
    "textbook.upload.begin": (knowledge_models.UploadBegin, knowledge.begin_upload),
    "textbook.upload.chunk": (knowledge_models.UploadChunk, knowledge.upload_chunk),
    "textbook.upload.finish": (models.Identifier, knowledge.finish_upload),
    "chapter.update": (knowledge_models.ChapterUpdate, knowledge.rename_chapter),
    "knowledge.review": (knowledge_models.KnowledgeReview, knowledge.review_knowledge),
    "lesson.create": (lessons.LessonCreate, lessons.create_lesson),
    "document.save": (document_models.DocumentSave, documents.save_document),
    "document.revise_segment": (document_models.SegmentRevision, documents.revise_segment),
    "document.export": (models.Identifier, documents.export_document),
    "slide.page.from_analysis": (reconstruction.PageFromAnalysis, reconstruction.from_analysis),
    "slide.page.revise": (reconstruction.PageRevision, reconstruction.revise),
    "slide.page.export": (models.Identifier, reconstruction.export_page),
    "slide.page.preview_export": (models.Identifier, reconstruction.preview_page),
    "slide.deck.export": (models.Identifier, reconstruction.export_deck),
}


def _get_course(conn, data):
    return records.get_record(conn, "course", data.id)


READS["course.get"] = (models.Identifier, _get_course)
READS["task.get"] = (models.Identifier, lambda conn, data: workflows.get_task(conn, data.id))
READS["task.list"] = (models.Input, lambda conn, data: workflows.list_tasks(conn))


class TeachingService:
    def __init__(self, ctx):
        self.ctx = ctx
        self.reads = {**READS, "knowledge.semantic": (knowledge_models.SemanticSearch, partial(semantic.search, ctx=ctx))}
        self.external_writes = {"slide.image.run": (models.Identifier, partial(images.execute, ctx=ctx)),
                                "slide.render.run": (models.Identifier, rendering.execute)}
        self.human_writes = {
            "task.review": (models.TaskReview, workflows.review_task),
            "document.review": (document_models.DocumentReview, documents.review_document),
            "document.generation.begin": (document_models.GenerationStart, partial(preparation.begin_generation, ctx=ctx)),
            "document.generation.claim": (document_models.GenerationClaim, preparation.claim_generation),
            "slide.image.set_budget": (image_models.ImageBudget, images.set_budget),
            "slide.image.reserve": (image_models.ImageReserve, images.reserve),
            "slide.image.abandon": (image_models.ImageAbandon, images.abandon),
            "slide.image.review": (image_assets.ImageReview, image_assets.review),
            "slide.image.reserve_analysis": (image_analysis.AnalysisReserve, image_analysis.reserve),
            "slide.page.review": (reconstruction.PageReview, reconstruction.review),
            "slide.render.begin": (rendering.RenderBegin, rendering.begin),
        }

    def call(self, operation, data=None, request_id=None, *, human=False, session_id=None):
        try:
            command = models.Command.model_validate({"operation": operation, "data": {} if data is None else data, "request_id": request_id})
            return {"ok": True, "data": self._call(command.operation, command.data, command.request_id, human, session_id)}
        except ValidationError as exc:
            return {"ok": False, "error": {"code": "invalid_input", "message": "输入格式不正确", "fields": exc.errors(include_input=False, include_context=False)}}
        except models.DomainError as exc:
            return {"ok": False, "error": {"code": exc.code, "message": str(exc)}}
        except sqlite3.IntegrityError:
            return {"ok": False, "error": {"code": "conflict", "message": "记录重复或关联约束冲突"}}
        except OSError:
            return {"ok": False, "error": {"code": "file_access_error", "message": "教学文件无法读取或保存，请检查文件权限与可用磁盘空间"}}

    def _call(self, operation, data, request_id, human, session_id):
        if operation == "schema":
            return {key: schema.model_json_schema() for key, (schema, _) in {**self.reads, **WRITES, **self.external_writes}.items()}
        if operation == "settings.get":
            return self.settings()
        if operation == "settings.update":
            return self.update_settings(data, human)
        writes = {**WRITES, **self.external_writes, **(self.human_writes if human else {})}
        reads = {**self.reads, "document.file": (models.Identifier, documents.read_export),
                 "slide.image.preview": (models.Identifier, image_assets.preview),
                 "slide.image.file": (models.Identifier, image_assets.download),
                 "slide.render.preview": (rendering.RenderAsset, rendering.preview),
                 "slide.render.file": (rendering.RenderAsset, rendering.download)} if human else self.reads
        schema, handler = ({**reads, **writes}).get(operation, (None, None))
        if schema is None:
            raise models.DomainError("unknown_operation", "不支持的操作")
        if not human and operation in self.settings()["disabled_operations"]:
            raise models.DomainError("permission_denied", "教师配置已禁用此 Agent 操作")
        if not human and operation.startswith(("student.", "enrollment.")) and not self.settings()["agent_student_access"]:
            raise models.DomainError("permission_denied", "学生资料默认仅供本地教师界面访问")
        if not human and operation == "knowledge.review":
            raise models.DomainError("permission_denied", "知识点确认需要教师在界面复核")
        payload = schema.model_validate(data)
        actor = "desktop:teacher" if human else "agent:" + (session_id or "local")
        if operation in self.external_writes:
            return handler(data=payload, actor=actor, request_id=request_id, session_id=session_id)
        with database() as conn:
            if operation in reads:
                return handler(conn=conn, data=payload)
            if not human and operation == "task.run" and "course.create" in self.settings()["disabled_operations"]:
                raise models.DomainError("permission_denied", "课程创建权限已禁用，任务不能代为创建课程")
            if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
                raise models.DomainError("invalid_request_id", "写操作需要 1–128 字符的 request_id")
            fingerprint = hashlib.sha256(encode(payload.model_dump()).encode("utf-8")).hexdigest()
            conn.execute("BEGIN IMMEDIATE")
            receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
            if receipt:
                fingerprints = {fingerprint}
                if operation == "document.save" and payload.kind in {"script", "lesson_plan"} and payload.plan_id is None:
                    # Schema 3 receipts predate the optional blueprint-plan association.
                    fingerprints.add(hashlib.sha256(encode(payload.model_dump(exclude={"plan_id"})).encode("utf-8")).hexdigest())
                if receipt["operation"] != operation or receipt["fingerprint"] not in fingerprints:
                    raise models.DomainError("idempotency_conflict", "同一 request_id 的操作和内容必须一致")
                return json.loads(receipt["result_json"])
            result = handler(conn=conn, data=payload, actor=actor)
            conn.execute("INSERT INTO command_receipts VALUES(?,?,?,?)", (request_id, operation, fingerprint, encode(result)))
            return result

    def settings(self):
        return models.Policy.model_validate(self.ctx.get_config("policy", {})).model_dump()

    def update_settings(self, data, human):
        if not human:
            raise models.DomainError("permission_denied", "模型和工具权限由教师在设置页修改")
        policy = models.Policy.model_validate({**self.settings(), **data})
        if any(op not in {**self.reads, **WRITES, **self.external_writes} for op in policy.disabled_operations):
            raise models.DomainError("invalid_input", "权限设置格式不正确")
        self.ctx.set_config("policy", policy.model_dump())
        return self.settings()
