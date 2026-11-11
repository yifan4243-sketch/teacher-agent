"""Allow explicitly attributed blueprint pages without inventing image or analysis records."""

SCHEMA = (
    """CREATE TABLE slide_pages_next (
        id TEXT PRIMARY KEY, blueprint_id TEXT NOT NULL REFERENCES teaching_documents(id), page_number INTEGER NOT NULL,
        version INTEGER NOT NULL, parent_id TEXT REFERENCES slide_pages(id), analysis_id TEXT REFERENCES slide_image_jobs(id),
        asset_id TEXT REFERENCES slide_image_assets(id), layout_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected')),
        created_by TEXT NOT NULL, reviewed_by TEXT, review_note TEXT, reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        source_mode TEXT NOT NULL DEFAULT 'vision' CHECK(source_mode IN ('vision','blueprint')),
        UNIQUE(blueprint_id,page_number,version),
        CHECK((source_mode='vision' AND analysis_id IS NOT NULL AND asset_id IS NOT NULL)
            OR (source_mode='blueprint' AND analysis_id IS NULL AND asset_id IS NULL))
    )""",
    """INSERT INTO slide_pages_next(id,blueprint_id,page_number,version,parent_id,analysis_id,asset_id,layout_json,
        status,created_by,reviewed_by,review_note,reviewed_at,created_at)
        SELECT id,blueprint_id,page_number,version,parent_id,analysis_id,asset_id,layout_json,
        status,created_by,reviewed_by,review_note,reviewed_at,created_at FROM slide_pages""",
    "DROP TABLE slide_pages",
    "ALTER TABLE slide_pages_next RENAME TO slide_pages",
)
