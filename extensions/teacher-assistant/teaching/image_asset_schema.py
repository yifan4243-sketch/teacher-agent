"""Preserve generated originals separately from documented widescreen derivatives."""

SCHEMA = (
    "ALTER TABLE slide_image_assets ADD COLUMN source_asset_id TEXT REFERENCES slide_image_assets(id)",
    "ALTER TABLE slide_image_assets ADD COLUMN processing_json TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE slide_image_assets ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE slide_image_assets ADD COLUMN review_note TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE slide_image_assets ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE slide_image_assets ADD COLUMN reviewed_at TEXT",
)
