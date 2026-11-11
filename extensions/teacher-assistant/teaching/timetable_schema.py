"""Published calendar membership preserves events and progress across compatible plan versions."""

SCHEMA = (
    """CREATE TABLE timetable_publications (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL UNIQUE REFERENCES semester_plans(id),
        root_id TEXT NOT NULL REFERENCES semester_plans(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        review_note TEXT NOT NULL, published_by TEXT NOT NULL, retired_at TEXT, snapshot_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE UNIQUE INDEX timetable_active_root ON timetable_publications(root_id) WHERE active=1",
    """CREATE TABLE timetable_events (
        id TEXT PRIMARY KEY, source_session_id TEXT NOT NULL UNIQUE REFERENCES planned_sessions(id),
        starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, timing_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
        version INTEGER NOT NULL DEFAULT 1, actual_minutes INTEGER, note TEXT NOT NULL DEFAULT '',
        lesson_id TEXT REFERENCES lessons(id),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE timetable_members (
        publication_id TEXT NOT NULL REFERENCES timetable_publications(id),
        planned_session_id TEXT NOT NULL UNIQUE REFERENCES planned_sessions(id),
        event_id TEXT NOT NULL REFERENCES timetable_events(id),
        PRIMARY KEY(publication_id,event_id)
    )""",
    "CREATE INDEX timetable_event_start ON timetable_events(starts_at,ends_at)",
)
