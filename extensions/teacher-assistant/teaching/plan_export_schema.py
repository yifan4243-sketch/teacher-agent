"""Immutable exports identify selected plan content and format."""

SCHEMA = (
    """CREATE TABLE plan_exports (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES semester_plans(id), format TEXT NOT NULL,
        selection_hash TEXT NOT NULL, scope_json TEXT NOT NULL, stored_path TEXT NOT NULL,
        sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, filename TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(plan_id,format,selection_hash)
    )""",
)
