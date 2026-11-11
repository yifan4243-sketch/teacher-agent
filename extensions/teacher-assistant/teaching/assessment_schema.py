"""Immutable question content with source links and local teacher review."""

SCHEMA = (
    """CREATE TABLE question_versions (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES question_versions(id),
        parent_id TEXT REFERENCES question_versions(id), version INTEGER NOT NULL,
        course_id TEXT NOT NULL REFERENCES courses(id), textbook_version_id TEXT NOT NULL REFERENCES textbook_versions(id),
        kind TEXT NOT NULL, difficulty TEXT NOT NULL, points_centi INTEGER NOT NULL CHECK(points_centi>0),
        prompt TEXT NOT NULL, prompt_hash TEXT NOT NULL, content_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
        created_by TEXT NOT NULL, reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(root_id,version)
    )""",
    """CREATE TABLE question_sources (
        question_id TEXT NOT NULL REFERENCES question_versions(id), source_id TEXT NOT NULL REFERENCES source_units(id),
        ordinal INTEGER NOT NULL, PRIMARY KEY(question_id,source_id), UNIQUE(question_id,ordinal)
    )""",
    """CREATE TABLE question_knowledge (
        question_id TEXT NOT NULL REFERENCES question_versions(id), knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id),
        PRIMARY KEY(question_id,knowledge_point_id)
    )""",
    "CREATE INDEX question_course_index ON question_versions(course_id,textbook_version_id,status)",
    "CREATE INDEX question_prompt_index ON question_versions(course_id,prompt_hash)",
)
