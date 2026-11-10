"""Version editable reconstructions independently from immutable design images."""

SCHEMA = (
    """CREATE TABLE slide_pages (
        id TEXT PRIMARY KEY, blueprint_id TEXT NOT NULL REFERENCES teaching_documents(id), page_number INTEGER NOT NULL,
        version INTEGER NOT NULL, parent_id TEXT REFERENCES slide_pages(id), analysis_id TEXT NOT NULL REFERENCES slide_image_jobs(id),
        asset_id TEXT NOT NULL REFERENCES slide_image_assets(id), layout_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
        created_by TEXT NOT NULL, reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(blueprint_id,page_number,version)
    )""",
    """CREATE TABLE slide_deck_exports (
        id TEXT PRIMARY KEY, blueprint_id TEXT NOT NULL REFERENCES teaching_documents(id), selection_hash TEXT NOT NULL,
        pages_json TEXT NOT NULL, stored_path TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, filename TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(blueprint_id,selection_hash)
    )""",
)
