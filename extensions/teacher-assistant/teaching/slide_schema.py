"""Link authoritative slide blueprints to the precise approved teaching artifacts."""

SCHEMA = (
    "ALTER TABLE teaching_documents ADD COLUMN plan_id TEXT REFERENCES teaching_documents(id)",
    "ALTER TABLE document_generations ADD COLUMN input_documents_json TEXT NOT NULL DEFAULT '{}'",
)
