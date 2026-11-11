"""One dispatch boundary for native tools and the authenticated Desktop RPC."""

import hashlib
import json
import sqlite3

from pydantic import ValidationError

from . import models
from .database import database, encode
from .routing import Operation


READS = {
    "grading.assist.schema": Operation('models.Input', 'routing.operation_schema', {'model_path': 'grading_models.GradeAssistSave'}),
    "grading.context": Operation('models.Identifier', 'grading_generation.context'),
    "grading.generation.get": Operation('models.Identifier', 'grading_generation.get_generation'),
    "exam.plan.schema": Operation('models.Input', 'routing.operation_schema', {'model_path': 'exam_models.ExamPlanSave'}),
    "exam.paper.schema": Operation('models.Input', 'routing.operation_schema', {'model_path': 'exam_models.ExamPaperSave'}),
    "exam.plan.get": Operation('models.Identifier', 'exams.get_plan'),
    "exam.plan.list": Operation('exam_models.ExamList', 'exams.list_plans'),
    "exam.paper.get": Operation('models.Identifier', 'exams.get_paper'),
    "exam.paper.list": Operation('exam_models.ExamList', 'exams.list_papers'),
    "exam.generation.get": Operation('models.Identifier', 'exam_generation.get_generation'),
    "exam.generation.list": Operation('models.Identifier', 'exam_generation.list_generations'),
    "question.schema": Operation('models.Input', 'routing.operation_schema', {'model_path': 'question_models.QuestionSave'}),
    "question.get": Operation('models.Identifier', 'questions.get_question'),
    "question.list": Operation('question_models.QuestionList', 'questions.list_questions'),
    "course.list": Operation('models.ListRecords', 'records.list_records', {'entity': 'course'}),
    "class.list": Operation('models.ListRecords', 'records.list_records', {'entity': 'class'}),
    "student.list": Operation('models.ListRecords', 'records.list_records', {'entity': 'student'}),
    "enrollment.list": Operation('models.CourseFilter', 'records.list_enrollments'),
    "course.classes": Operation('models.CourseFilter', 'records.list_course_classes'),
    "textbook.list": Operation('models.CourseFilter', 'knowledge.list_books'),
    "textbook.get": Operation('models.Identifier', 'knowledge.get_book'),
    "textbook.version": Operation('models.Identifier', 'knowledge.get_version'),
    "source.get": Operation('models.Identifier', 'knowledge.get_source'),
    "source.list": Operation('knowledge_models.VersionFilter', 'knowledge.list_sources'),
    "knowledge.list": Operation('knowledge_models.VersionFilter', 'knowledge.list_knowledge'),
    "knowledge.search": Operation('knowledge_models.SourceSearch', 'knowledge.search_sources'),
    "lesson.get": Operation('models.Identifier', 'lessons.get_lesson'),
    "lesson.list": Operation('models.CourseFilter', 'lessons.list_lessons'),
    "document.get": Operation('models.Identifier', 'documents.get_document'),
    "document.list": Operation('document_models.DocumentList', 'documents.list_documents'),
    "document.schema": Operation('models.Input', 'preparation.content_schema'),
    "preparation.context": Operation('models.Identifier', 'preparation.context'),
    "document.generation.get": Operation('models.Identifier', 'preparation.get_generation'),
    "document.generation.list": Operation('document_models.DocumentList', 'preparation.list_generations'),
    "slide.prompt": Operation('blueprint_models.PageRequest', 'blueprints.get_prompt'),
    "slide.themes": Operation('models.Input', 'blueprints.list_themes'),
    "slide.reference.list": Operation('image_models.ImageList', 'slide_references.list_references'),
    "slide.image.get": Operation('models.Identifier', 'images.get_job'),
    "slide.image.list": Operation('image_models.ImageList', 'images.list_jobs'),
    "slide.image.budget": Operation('image_models.BlueprintFilter', 'images.budget'),
    "slide.page.get": Operation('models.Identifier', 'reconstruction.get_page'),
    "slide.page.list": Operation('reconstruction.PageList', 'reconstruction.list_pages'),
    "slide.render.get": Operation('models.Identifier', 'rendering.get_job'),
    "slide.render.list": Operation('rendering.RenderList', 'rendering.list_jobs'),
    "plan.get": Operation('models.Identifier', 'planning.get_plan'),
    "plan.list": Operation('models.CourseFilter', 'planning.list_plans'),
    "calendar.list": Operation('timetable_models.CalendarRange', 'timetable.list_calendar'),
    "calendar.get": Operation('models.Identifier', 'timetable.get_event'),
    "calendar.history": Operation('models.Identifier', 'timetable.history'),
    "calendar.publication": Operation('models.Identifier', 'timetable.get_publication'),
    "calendar.preparation": Operation('models.Identifier', 'preparation_status.for_event'),
    "reminder.settings": Operation('models.Input', 'reminders.settings'),
    "reminder.list": Operation('reminder_models.ReminderList', 'reminders.list_deliveries'),
    "reminder.get": Operation('models.Identifier', 'reminders.get_delivery'),
    "todo.list": Operation('reminder_models.TodoList', 'todos.list_todos'),
    "todo.get": Operation('models.Identifier', 'todos.get_todo'),
}
WRITES = {
    "grading.assist.save": Operation('grading_models.GradeAssistSave', 'grading_generation.save_assistance'),
    "exam.plan.save": Operation('exam_models.ExamPlanSave', 'exams.save_plan'),
    "exam.paper.save": Operation('exam_models.ExamPaperSave', 'exams.save_paper'),
    "exam.export": Operation('exam_models.ExamExport', 'exam_export.export'),
    "question.save": Operation('question_models.QuestionSave', 'questions.save_question'),
    "todo.create": Operation('reminder_models.TodoCreate', 'todos.create'),
    "todo.update": Operation('reminder_models.TodoUpdate', 'todos.update'),
    "reminder.refresh": Operation('models.Input', 'reminders.refresh'),
    "reminder.retry": Operation('models.Identifier', 'reminders.retry'),
    "course.create": Operation('models.CourseCreate', 'records.create_record', {'entity': 'course'}),
    "plan.save": Operation('planning_models.PlanSave', 'planning.save'),
    "plan.export": Operation('plan_export.PlanExport', 'plan_export.export'),
    "course.update": Operation('models.CourseUpdate', 'records.update_record', {'entity': 'course'}),
    "class.create": Operation('models.ClassCreate', 'records.create_record', {'entity': 'class'}),
    "class.update": Operation('models.ClassUpdate', 'records.update_record', {'entity': 'class'}),
    "student.create": Operation('models.StudentCreate', 'records.create_record', {'entity': 'student'}),
    "student.update": Operation('models.StudentUpdate', 'records.update_record', {'entity': 'student'}),
    "course.assign_class": Operation('models.CourseClass', 'records.assign_class'),
    "enrollment.create": Operation('models.Enrollment', 'records.enroll'),
    "task.create": Operation('models.TaskCreate', 'workflows.create_task'),
    "task.run": Operation('models.Identifier', 'workflows.run_task'),
    "task.cancel": Operation('models.TaskChange', 'workflows.change_task', {'target': 'cancelled'}),
    "task.retry": Operation('models.TaskChange', 'workflows.change_task', {'target': 'pending'}),
    "textbook.import": Operation('knowledge_models.ImportBook', 'knowledge.import_book'),
    "textbook.upload.begin": Operation('knowledge_models.UploadBegin', 'knowledge.begin_upload'),
    "textbook.upload.chunk": Operation('knowledge_models.UploadChunk', 'knowledge.upload_chunk'),
    "textbook.upload.finish": Operation('models.Identifier', 'knowledge.finish_upload'),
    "chapter.update": Operation('knowledge_models.ChapterUpdate', 'knowledge.rename_chapter'),
    "knowledge.review": Operation('knowledge_models.KnowledgeReview', 'knowledge.review_knowledge'),
    "lesson.create": Operation('lessons.LessonCreate', 'lessons.create_lesson'),
    "document.save": Operation('document_models.DocumentSave', 'documents.save_document'),
    "document.revise_segment": Operation('document_models.SegmentRevision', 'documents.revise_segment'),
    "document.export": Operation('models.Identifier', 'documents.export_document'),
    "slide.page.from_analysis": Operation('reconstruction.PageFromAnalysis', 'reconstruction.from_analysis'),
    "slide.page.revise": Operation('reconstruction.PageRevision', 'reconstruction.revise'),
    "slide.page.export": Operation('models.Identifier', 'reconstruction.export_page'),
    "slide.page.preview_export": Operation('models.Identifier', 'reconstruction.preview_page'),
    "slide.deck.export": Operation('models.Identifier', 'reconstruction.export_deck'),
    "slide.deck.from_blueprint": Operation('models.Identifier', 'template_slides.create_deck'),
    "slide.page.fit_text": Operation('layout_repair.RepairRequest', 'layout_repair.repair'),
}


def _get_course(conn, data):
    from .records import get_record
    return get_record(conn, "course", data.id)


READS["course.get"] = Operation('models.Identifier', 'service._get_course')
READS["task.get"] = Operation('models.Identifier', 'routing.get_task')
READS["task.list"] = Operation('models.Input', 'routing.list_tasks')


class TeachingService:
    def __init__(self, ctx):
        self.ctx = ctx
        self.reads = {**READS, "knowledge.semantic": Operation('knowledge_models.SemanticSearch', 'semantic.search', {'ctx': ctx})}
        self.external_writes = {"slide.image.run": Operation('models.Identifier', 'images.execute', {'ctx': ctx}),
                                "slide.render.run": Operation('models.Identifier', 'rendering.execute')}
        self.human_external_writes = {
            "reminder.background.install": Operation('models.Input', 'reminder_schedule.install'),
            "reminder.background.remove": Operation('models.Input', 'reminder_schedule.remove'),
        }
        self.human_writes = {
            "submission.save": Operation('grading_models.SubmissionSave', 'submissions.save'),
            "grading.score": Operation('grading_models.GradeScore', 'grading.score_submission'),
            "grading.publish": Operation('grading_models.GradeReview', 'grading.publish'),
            "grading.generation.begin": Operation('exam_models.ExamGenerationStart', 'grading_generation.begin', {'ctx': ctx}),
            "grading.generation.claim": Operation('document_models.GenerationClaim', 'grading_generation.claim'),
            "exam.paper.review": Operation('question_models.QuestionReview', 'exams.review_paper'),
            "exam.generation.begin": Operation('exam_models.ExamGenerationStart', 'exam_generation.begin', {'ctx': ctx}),
            "exam.generation.claim": Operation('document_models.GenerationClaim', 'exam_generation.claim'),
            "question.review": Operation('question_models.QuestionReview', 'questions.review_question'),
            "task.review": Operation('models.TaskReview', 'workflows.review_task'),
            "plan.publish": Operation('timetable_models.PlanPublish', 'publication.publish'),
            "calendar.move": Operation('timetable_models.EventMove', 'timetable.move'),
            "calendar.progress": Operation('timetable_models.ProgressRecord', 'timetable.record_progress'),
            "reminder.set_settings": Operation('reminder_models.ReminderSettings', 'reminders.save_settings'),
            "reminder.test": Operation('models.Input', 'windows_notifications.test_notification'),
            "document.review": Operation('document_models.DocumentReview', 'documents.review_document'),
            "document.generation.begin": Operation('document_models.GenerationStart', 'preparation.begin_generation', {'ctx': ctx}),
            "document.generation.claim": Operation('document_models.GenerationClaim', 'preparation.claim_generation'),
            "slide.image.set_budget": Operation('image_models.ImageBudget', 'images.set_budget'),
            "slide.image.reserve": Operation('image_models.ImageReserve', 'images.reserve'),
            "slide.image.reserve_references": Operation('slide_references.ReferenceReserve', 'images.reserve'),
            "slide.reference.upload": Operation('slide_references.ReferenceUpload', 'slide_references.upload'),
            "slide.reference.archive": Operation('models.Identifier', 'slide_references.archive'),
            "slide.image.abandon": Operation('image_models.ImageAbandon', 'images.abandon'),
            "slide.image.review": Operation('image_assets.ImageReview', 'image_assets.review'),
            "slide.image.reserve_analysis": Operation('image_analysis.AnalysisReserve', 'image_analysis.reserve'),
            "slide.page.review": Operation('reconstruction.PageReview', 'reconstruction.review'),
            "slide.render.begin": Operation('rendering.RenderBegin', 'rendering.begin'),
        }

    def call(self, operation, data=None, request_id=None, *, human=False, session_id=None):
        try:
            command = models.Command.model_validate({"operation": operation, "data": {} if data is None else data, "request_id": request_id})
            if not human and command.operation in {"grading.context", "grading.assist.save"}:
                from .grading_generation import check_session
                identifier = models.Identifier.model_validate({"id": command.data.get("id")})
                with database() as conn:
                    check_session(conn, identifier, session_id)
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
            return {key: spec.resolve()[0].model_json_schema() for key, spec in {**self.reads, **WRITES, **self.external_writes}.items()}
        if operation == "settings.get":
            return self.settings()
        if operation == "settings.update":
            return self.update_settings(data, human)
        writes = {**WRITES, **self.external_writes, **(self.human_writes if human else {}),
                  **(self.human_external_writes if human else {})}
        reads = {**self.reads, "document.file": Operation('models.Identifier', 'documents.read_export'),
                 "submission.get": Operation('models.Identifier', 'submissions.get_submission'),
                 "submission.list": Operation('grading_models.SubmissionList', 'submissions.list_submissions'),
                 "grading.draft.get": Operation('models.Identifier', 'grading.get_draft'),
                 "grading.generation.list": Operation('models.Identifier', 'grading_generation.list_generations'),
                 "grade.get": Operation('models.Identifier', 'grading.get_grade'),
                 "grade.list": Operation('grading_models.GradeList', 'grading.list_grades'),
                 "reminder.probe": Operation('models.Input', 'windows_notifications.probe'),
                 "reminder.background.status": Operation('models.Input', 'reminder_schedule.status'),
                 "plan.export.file": Operation('models.Identifier', 'plan_export.download'),
                 "exam.export.file": Operation('models.Identifier', 'exam_export.download'),
                 "slide.image.preview": Operation('models.Identifier', 'image_assets.preview'),
                 "slide.image.file": Operation('models.Identifier', 'image_assets.download'),
                 "slide.reference.preview": Operation('models.Identifier', 'slide_references.preview'),
                 "slide.render.preview": Operation('rendering.RenderAsset', 'rendering.preview'),
                 "slide.render.file": Operation('rendering.RenderAsset', 'rendering.download')} if human else self.reads
        spec = ({**reads, **writes}).get(operation)
        if spec is None:
            raise models.DomainError("unknown_operation", "不支持的操作")
        if not human and operation in self.settings()["disabled_operations"]:
            raise models.DomainError("permission_denied", "教师配置已禁用此 Agent 操作")
        if not human and operation.startswith(("student.", "enrollment.")) and not self.settings()["agent_student_access"]:
            raise models.DomainError("permission_denied", "学生资料默认仅供本地教师界面访问")
        if not human and operation == "knowledge.review":
            raise models.DomainError("permission_denied", "知识点确认需要教师在界面复核")
        schema, handler = spec.resolve()
        payload = schema.model_validate(data)
        actor = "desktop:teacher" if human else "agent:" + (session_id or "local")
        if operation in self.external_writes or operation in self.human_external_writes:
            return handler(data=payload, actor=actor, request_id=request_id, session_id=session_id)
        with database() as conn:
            if operation in reads:
                return handler(conn=conn, data=payload)
            if not human and operation == "task.run" and "course.create" in self.settings()["disabled_operations"]:
                raise models.DomainError("permission_denied", "课程创建权限已禁用，任务不能代为创建课程")
            if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
                raise models.DomainError("invalid_request_id", "写操作需要 1–128 字符的 request_id")
            fingerprint = hashlib.sha256(encode(payload.model_dump(mode="json")).encode("utf-8")).hexdigest()
            conn.execute("BEGIN IMMEDIATE")
            receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
            if receipt:
                fingerprints = {fingerprint}
                if operation == "document.save" and payload.kind in {"script", "lesson_plan"} and payload.plan_id is None:
                    # Schema 3 receipts predate the optional blueprint-plan association.
                    fingerprints.add(hashlib.sha256(encode(payload.model_dump(exclude={"plan_id"})).encode("utf-8")).hexdigest())
                if operation == "plan.save" and not payload.session_content:
                    fingerprints.add(hashlib.sha256(encode(payload.model_dump(mode="json", exclude={"session_content"})).encode("utf-8")).hexdigest())
                if operation == "reminder.set_settings" and payload.break_lead_minutes is None and payload.end_lead_minutes is None:
                    fingerprints.add(hashlib.sha256(encode(payload.model_dump(mode="json", exclude={"break_lead_minutes", "end_lead_minutes"})).encode("utf-8")).hexdigest())
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
