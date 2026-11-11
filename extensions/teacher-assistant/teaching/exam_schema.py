"""Additive exam migration keeps bank history and exact assessment provenance."""

SCHEMA = (
    """CREATE TABLE exam_plans (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES exam_plans(id), parent_id TEXT REFERENCES exam_plans(id),
        version INTEGER NOT NULL, course_id TEXT NOT NULL REFERENCES courses(id),
        textbook_version_id TEXT NOT NULL REFERENCES textbook_versions(id), title TEXT NOT NULL,
        config_json TEXT NOT NULL, scope_json TEXT NOT NULL, created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(root_id,version)
    )""",
    """CREATE TABLE exam_papers (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES exam_papers(id), parent_id TEXT REFERENCES exam_papers(id),
        version INTEGER NOT NULL, plan_id TEXT NOT NULL REFERENCES exam_plans(id), title TEXT NOT NULL,
        report_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
        created_by TEXT NOT NULL, reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(root_id,version)
    )""",
    """CREATE TABLE exam_questions (
        paper_id TEXT NOT NULL REFERENCES exam_papers(id), ordinal INTEGER NOT NULL,
        question_id TEXT NOT NULL REFERENCES question_versions(id),
        PRIMARY KEY(paper_id,ordinal), UNIQUE(paper_id,question_id)
    )""",
    """CREATE TABLE exam_generations (
        workflow_id TEXT PRIMARY KEY REFERENCES workflows(id), plan_id TEXT NOT NULL REFERENCES exam_plans(id),
        prompt TEXT NOT NULL, model_json TEXT NOT NULL, runtime_session_id TEXT, stored_session_id TEXT,
        paper_id TEXT REFERENCES exam_papers(id)
    )""",
    """CREATE TABLE exam_exports (
        id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES exam_papers(id), audience TEXT NOT NULL,
        format TEXT NOT NULL, stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL,
        filename TEXT NOT NULL, UNIQUE(paper_id,audience,format)
    )""",
    "CREATE INDEX exam_plan_course ON exam_plans(course_id,created_at)",
)
