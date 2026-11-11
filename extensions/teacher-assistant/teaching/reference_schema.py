"""Optional style references are local until the teacher authorizes a specific image job."""

SCHEMA = (
    """CREATE TABLE slide_references (
        id TEXT PRIMARY KEY, blueprint_id TEXT NOT NULL REFERENCES teaching_documents(id), label TEXT NOT NULL,
        source_note TEXT NOT NULL, stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, width INTEGER NOT NULL,
        height INTEGER NOT NULL, format TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE slide_job_references (
        job_id TEXT PRIMARY KEY REFERENCES slide_image_jobs(id), reference_id TEXT NOT NULL REFERENCES slide_references(id),
        sha256 TEXT NOT NULL
    )""",
)
