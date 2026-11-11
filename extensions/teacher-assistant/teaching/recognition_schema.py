"""Immutable answer files, page jobs and teacher-corrected submission provenance."""

SCHEMA = (
    """CREATE TABLE answer_uploads (
        id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES exam_papers(id), student_id TEXT NOT NULL REFERENCES students(id),
        filename TEXT NOT NULL, total_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, bytes_received INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'uploading', result_file_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE answer_files (
        id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES exam_papers(id), student_id TEXT NOT NULL REFERENCES students(id),
        filename TEXT NOT NULL, stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL, page_count INTEGER NOT NULL CHECK(page_count BETWEEN 1 AND 200),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE answer_pages (
        file_id TEXT NOT NULL REFERENCES answer_files(id), page_number INTEGER NOT NULL,
        stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
        PRIMARY KEY(file_id,page_number)
    )""",
    """CREATE TABLE recognition_budgets (
        file_id TEXT PRIMARY KEY REFERENCES answer_files(id), budget_micro_usd INTEGER NOT NULL CHECK(budget_micro_usd>=0)
    )""",
    """CREATE TABLE recognition_jobs (
        id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES answer_files(id), page_number INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','running','succeeded','failed','cancelled')),
        model_json TEXT NOT NULL, routing_fingerprint TEXT NOT NULL, cache_key TEXT NOT NULL, estimated_micro_usd INTEGER NOT NULL,
        attempted INTEGER NOT NULL DEFAULT 0 CHECK(attempted IN (0,1)), execution_token TEXT,
        reported_micro_usd INTEGER, usage_json TEXT NOT NULL DEFAULT '{}', result_json TEXT NOT NULL DEFAULT '{}', error_code TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE INDEX recognition_file_page ON recognition_jobs(file_id,page_number,created_at)",
    """CREATE TABLE submission_recognitions (
        submission_id TEXT NOT NULL REFERENCES answer_submissions(id), job_id TEXT NOT NULL REFERENCES recognition_jobs(id),
        reviewed_by TEXT NOT NULL, reviewed_uncertain INTEGER NOT NULL CHECK(reviewed_uncertain IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(submission_id,job_id)
    )""",
)
