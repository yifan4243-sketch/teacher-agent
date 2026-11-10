"""Additive textbook migration, preserving version-one teaching records."""

SCHEMA = (
    """CREATE TABLE textbooks (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE textbook_versions (
        id TEXT PRIMARY KEY, textbook_id TEXT NOT NULL REFERENCES textbooks(id), version INTEGER NOT NULL,
        sha256 TEXT NOT NULL, filename TEXT NOT NULL, stored_path TEXT NOT NULL, byte_size INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(textbook_id,version), UNIQUE(textbook_id,sha256)
    )""",
    """CREATE TABLE chapters (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES textbook_versions(id),
        parent_id TEXT REFERENCES chapters(id), ordinal INTEGER NOT NULL, level INTEGER NOT NULL,
        title TEXT NOT NULL, UNIQUE(version_id,ordinal)
    )""",
    """CREATE TABLE source_units (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES textbook_versions(id),
        chapter_id TEXT REFERENCES chapters(id), ordinal INTEGER NOT NULL,
        kind TEXT NOT NULL, page INTEGER, locator TEXT NOT NULL, text TEXT NOT NULL,
        UNIQUE(version_id,ordinal)
    )""",
    """CREATE TABLE knowledge_points (
        id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES textbook_versions(id),
        chapter_id TEXT REFERENCES chapters(id), source_id TEXT NOT NULL REFERENCES source_units(id),
        title TEXT NOT NULL, text TEXT NOT NULL, method TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'extracted' CHECK(review_status IN ('extracted','reviewed'))
    )""",
    "CREATE VIRTUAL TABLE source_fts USING fts5(source_id UNINDEXED,text,tokenize='trigram')",
    """CREATE TABLE textbook_uploads (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), textbook_id TEXT REFERENCES textbooks(id),
        title TEXT NOT NULL, filename TEXT NOT NULL, total_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
        bytes_received INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'uploading', result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE INDEX source_version_index ON source_units(version_id,ordinal)",
    "CREATE INDEX knowledge_chapter_index ON knowledge_points(chapter_id)",
    """CREATE TABLE lessons (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
        version_id TEXT NOT NULL REFERENCES textbook_versions(id), title TEXT NOT NULL,
        objectives TEXT NOT NULL, key_points TEXT NOT NULL, difficulties TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE lesson_sources (
        lesson_id TEXT NOT NULL REFERENCES lessons(id), source_id TEXT NOT NULL REFERENCES source_units(id),
        ordinal INTEGER NOT NULL, PRIMARY KEY(lesson_id,source_id), UNIQUE(lesson_id,ordinal)
    )""",
)
