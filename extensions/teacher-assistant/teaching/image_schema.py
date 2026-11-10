"""Image job reservations remain durable across retries and interrupted requests."""

SCHEMA = (
    """CREATE TABLE slide_image_budgets (
        blueprint_id TEXT PRIMARY KEY REFERENCES teaching_documents(id), budget_micro_usd INTEGER NOT NULL CHECK(budget_micro_usd>=0)
    )""",
    """CREATE TABLE slide_image_jobs (
        id TEXT PRIMARY KEY, blueprint_id TEXT NOT NULL REFERENCES teaching_documents(id), page_number INTEGER NOT NULL,
        prompt TEXT NOT NULL, cache_key TEXT NOT NULL, config_fingerprint TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','running','succeeded','failed','cancelled','cached')),
        estimated_micro_usd INTEGER NOT NULL, attempted INTEGER NOT NULL DEFAULT 0,
        reported_micro_usd INTEGER, execution_token TEXT, asset_id TEXT REFERENCES slide_image_assets(id), error_code TEXT,
        provider TEXT, model TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE slide_image_assets (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES slide_image_jobs(id), stored_path TEXT NOT NULL,
        sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
        format TEXT NOT NULL, verification_status TEXT NOT NULL DEFAULT 'needs_text_review',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(job_id,sha256)
    )""",
    "CREATE INDEX image_job_cache_index ON slide_image_jobs(cache_key,state)",
    "CREATE INDEX image_job_blueprint_index ON slide_image_jobs(blueprint_id,created_at)",
)
