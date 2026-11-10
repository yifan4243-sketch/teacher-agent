"""Versioned teaching documents and immutable exported DOCX files."""

SCHEMA = (
    """CREATE TABLE teaching_documents (
        id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), kind TEXT NOT NULL,
        version INTEGER NOT NULL, parent_id TEXT REFERENCES teaching_documents(id),
        script_id TEXT REFERENCES teaching_documents(id), content_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
        created_by TEXT NOT NULL, reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(lesson_id,kind,version)
    )""",
    """CREATE TABLE teaching_exports (
        id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES teaching_documents(id),
        stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL,
        filename TEXT NOT NULL, template_sha256 TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(document_id)
    )""",
    """CREATE TABLE document_generations (
        workflow_id TEXT PRIMARY KEY REFERENCES workflows(id), lesson_id TEXT NOT NULL REFERENCES lessons(id),
        kind TEXT NOT NULL, expected_version INTEGER NOT NULL, prompt TEXT NOT NULL, model_json TEXT NOT NULL,
        runtime_session_id TEXT, stored_session_id TEXT, document_id TEXT REFERENCES teaching_documents(id)
    )""",
)
