"""Reviewed grade report files retain identity-specific export snapshots by content hash."""

SCHEMA = (
    """CREATE TABLE grade_exports (
        id TEXT PRIMARY KEY, grade_id TEXT NOT NULL REFERENCES grade_publications(id),
        format TEXT NOT NULL, source_hash TEXT NOT NULL, stored_path TEXT NOT NULL,
        sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, filename TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(grade_id,format,source_hash)
    )""",
)
