"""Durable local Office rendering jobs retain the precise input export and pixel comparison."""

SCHEMA = (
    """CREATE TABLE slide_render_jobs (
        id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES slide_pages(id), export_id TEXT NOT NULL REFERENCES slide_deck_exports(id),
        renderer TEXT NOT NULL CHECK(renderer IN ('wps','powerpoint')),
        state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','failed')),
        error_code TEXT, renderer_version TEXT, stored_path TEXT, sha256 TEXT, byte_size INTEGER,
        difference_path TEXT, difference_sha256 TEXT, comparison_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE INDEX slide_render_page_index ON slide_render_jobs(page_id,created_at)",
)
