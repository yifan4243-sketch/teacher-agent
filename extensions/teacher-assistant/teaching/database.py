"""Teaching storage is separate from Hermes conversation storage."""

from contextlib import contextmanager
import json
import sqlite3
from uuid import uuid4

from plugins.plugin_storage import plugin_db

from .knowledge_schema import SCHEMA as KNOWLEDGE_SCHEMA
from .document_schema import SCHEMA as DOCUMENT_SCHEMA
from .slide_schema import SCHEMA as SLIDE_SCHEMA
from .image_schema import SCHEMA as IMAGE_SCHEMA
from .image_asset_schema import SCHEMA as IMAGE_ASSET_SCHEMA
from .image_analysis_schema import SCHEMA as IMAGE_ANALYSIS_SCHEMA
from .reconstruction_schema import SCHEMA as RECONSTRUCTION_SCHEMA
from .render_schema import SCHEMA as RENDER_SCHEMA
from .repair_schema import SCHEMA as REPAIR_SCHEMA
from .template_schema import SCHEMA as TEMPLATE_SCHEMA


SCHEMA = (
    """CREATE TABLE courses (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '', objectives TEXT NOT NULL DEFAULT '',
        period_minutes INTEGER NOT NULL CHECK(period_minutes BETWEEN 1 AND 240),
        period_count INTEGER NOT NULL CHECK(period_count BETWEEN 1 AND 8),
        break_minutes INTEGER NOT NULL CHECK(break_minutes BETWEEN 0 AND 120),
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE classes (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, academic_year TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE students (
        id TEXT PRIMARY KEY, student_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        class_id TEXT NOT NULL REFERENCES classes(id),
        archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE course_classes (
        course_id TEXT NOT NULL REFERENCES courses(id), class_id TEXT NOT NULL REFERENCES classes(id),
        PRIMARY KEY(course_id,class_id)
    )""",
    """CREATE TABLE enrollments (
        course_id TEXT NOT NULL REFERENCES courses(id), student_id TEXT NOT NULL REFERENCES students(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY(course_id,student_id)
    )""",
    """CREATE TABLE workflows (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL
        CHECK(status IN ('pending','running','awaiting_review','completed','failed','cancelled')),
        input_json TEXT NOT NULL, result_json TEXT, error TEXT, version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE workflow_steps (
        workflow_id TEXT NOT NULL REFERENCES workflows(id), step_key TEXT NOT NULL,
        result_json TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY(workflow_id,step_key)
    )""",
    """CREATE TABLE approvals (
        id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL UNIQUE REFERENCES workflows(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
        workflow_version INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', reviewed_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), reviewed_at TEXT
    )""",
    """CREATE TABLE command_receipts (
        request_id TEXT PRIMARY KEY, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL
    )""",
    """CREATE TABLE audit_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        action TEXT NOT NULL, actor TEXT NOT NULL, before_json TEXT, after_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE INDEX student_class_index ON students(class_id)",
    "CREATE INDEX enrollment_student_index ON enrollments(student_id)",
)


@contextmanager
def database():
    conn = plugin_db("teacher-assistant", "teaching.db")
    conn.row_factory = sqlite3.Row
    try:
        migrations = (SCHEMA, KNOWLEDGE_SCHEMA, DOCUMENT_SCHEMA, SLIDE_SCHEMA, IMAGE_SCHEMA, IMAGE_ASSET_SCHEMA, IMAGE_ANALYSIS_SCHEMA, RECONSTRUCTION_SCHEMA, RENDER_SCHEMA, REPAIR_SCHEMA, TEMPLATE_SCHEMA)
        if conn.execute("PRAGMA user_version").fetchone()[0] > len(migrations):
            raise ValueError("教学数据库来自更新版本，请升级教师插件")
        if conn.execute("PRAGMA user_version").fetchone()[0] < len(migrations):
            # SQLite table rebuilds require disabling FK actions outside the transaction.
            # Validate all links before commit, then restore enforcement before serving writes.
            conn.execute("PRAGMA foreign_keys=OFF")
            conn.execute("BEGIN IMMEDIATE")
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            for index in range(version, len(migrations)):
                for statement in migrations[index]:
                    conn.execute(statement)
                conn.execute(f"PRAGMA user_version={index + 1}")
            if conn.execute("PRAGMA foreign_key_check").fetchone():
                raise ValueError("教学数据库迁移后关联校验失败，已撤销迁移")
            conn.commit()
            conn.execute("PRAGMA foreign_keys=ON")
        with conn:
            yield conn
    finally:
        conn.close()


def new_id():
    return str(uuid4())


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def audit(conn, entity, identifier, action, actor, before, after):
    conn.execute(
        "INSERT INTO audit_events(entity_type,entity_id,action,actor,before_json,after_json) VALUES(?,?,?,?,?,?)",
        (entity, identifier, action, actor, encode(before), encode(after)),
    )
