"""Keep the measured render that produced each automatic text-fit revision."""

SCHEMA = (
    """CREATE TABLE slide_page_repairs (
        page_id TEXT PRIMARY KEY REFERENCES slide_pages(id), render_job_id TEXT NOT NULL REFERENCES slide_render_jobs(id),
        minimum_font_pixels REAL NOT NULL, report_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
)
