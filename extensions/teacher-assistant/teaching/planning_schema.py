"""Versioned semester inputs and real dated sessions for later reminders and progress."""

SCHEMA = (
    """CREATE TABLE semester_plans (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES semester_plans(id), parent_id TEXT REFERENCES semester_plans(id),
        course_id TEXT NOT NULL REFERENCES courses(id), textbook_version_id TEXT NOT NULL REFERENCES textbook_versions(id),
        title TEXT NOT NULL, version INTEGER NOT NULL, config_json TEXT NOT NULL,
        created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(root_id,version)
    )""",
    """CREATE TABLE planned_sessions (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES semester_plans(id), ordinal INTEGER NOT NULL,
        chapter_id TEXT REFERENCES chapters(id), kind TEXT NOT NULL CHECK(kind IN ('teaching','practice','review','exam')),
        title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
        instruction_minutes INTEGER NOT NULL, assessment_minutes INTEGER NOT NULL, timing_json TEXT NOT NULL,
        UNIQUE(plan_id,ordinal)
    )""",
)
