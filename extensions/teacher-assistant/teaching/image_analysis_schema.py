"""Reuse paid visual extraction for both content checks and editable reconstruction."""

SCHEMA = (
    "ALTER TABLE slide_image_jobs ADD COLUMN kind TEXT NOT NULL DEFAULT 'generation' CHECK(kind IN ('generation','analysis'))",
    "ALTER TABLE slide_image_jobs ADD COLUMN input_asset_id TEXT REFERENCES slide_image_assets(id)",
    "ALTER TABLE slide_image_jobs ADD COLUMN result_json TEXT NOT NULL DEFAULT '{}'",
)
