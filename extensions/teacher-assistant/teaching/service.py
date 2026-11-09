"""One dispatch boundary for native tools and the authenticated Desktop RPC."""

from functools import partial
import hashlib
import json
import sqlite3

from pydantic import ValidationError

from . import models, records, workflows
from .database import database, encode


READS = {
    "course.list": (models.ListRecords, partial(records.list_records, entity="course")),
    "class.list": (models.ListRecords, partial(records.list_records, entity="class")),
    "student.list": (models.ListRecords, partial(records.list_records, entity="student")),
    "enrollment.list": (models.CourseFilter, records.list_enrollments),
    "course.classes": (models.CourseFilter, records.list_course_classes),
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
}


def _get_course(conn, data):
    return records.get_record(conn, "course", data.id)


READS["course.get"] = (models.Identifier, _get_course)
READS["task.get"] = (models.Identifier, lambda conn, data: workflows.get_task(conn, data.id))
READS["task.list"] = (models.Input, lambda conn, data: workflows.list_tasks(conn))


class TeachingService:
    def __init__(self, ctx):
        self.ctx = ctx

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

    def _call(self, operation, data, request_id, human, session_id):
        if operation == "schema":
            return {key: schema.model_json_schema() for key, (schema, _) in {**READS, **WRITES}.items()}
        if operation == "settings.get":
            return self.settings()
        if operation == "settings.update":
            return self.update_settings(data, human)
        writes = {**WRITES, "task.review": (models.TaskReview, workflows.review_task)} if human else WRITES
        schema, handler = ({**READS, **writes}).get(operation, (None, None))
        if schema is None:
            raise models.DomainError("unknown_operation", "不支持的操作")
        if not human and operation in self.settings()["disabled_operations"]:
            raise models.DomainError("permission_denied", "教师配置已禁用此 Agent 操作")
        if not human and operation.startswith(("student.", "enrollment.")) and not self.settings()["agent_student_access"]:
            raise models.DomainError("permission_denied", "学生资料默认仅供本地教师界面访问")
        payload = schema.model_validate(data)
        actor = "desktop:teacher" if human else "agent:" + (session_id or "local")
        with database() as conn:
            if operation in READS:
                return handler(conn=conn, data=payload)
            if not human and operation == "task.run" and "course.create" in self.settings()["disabled_operations"]:
                raise models.DomainError("permission_denied", "课程创建权限已禁用，任务不能代为创建课程")
            if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
                raise models.DomainError("invalid_request_id", "写操作需要 1–128 字符的 request_id")
            fingerprint = hashlib.sha256(encode(payload.model_dump()).encode("utf-8")).hexdigest()
            conn.execute("BEGIN IMMEDIATE")
            receipt = conn.execute("SELECT * FROM command_receipts WHERE request_id=?", (request_id,)).fetchone()
            if receipt:
                if receipt["operation"] != operation or receipt["fingerprint"] != fingerprint:
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
        if any(op not in {**READS, **WRITES} for op in policy.disabled_operations):
            raise models.DomainError("invalid_input", "权限设置格式不正确")
        self.ctx.set_config("policy", policy.model_dump())
        return self.settings()
