"""Profile-local reminder policy, teacher tasks and durable notification attempts."""

SCHEMA = (
    """CREATE TABLE reminder_settings (
        id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 1,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
        preclass_minutes INTEGER DEFAULT 15, preparation_minutes INTEGER DEFAULT 1440, exam_minutes INTEGER DEFAULT 60,
        late_grace_minutes INTEGER NOT NULL DEFAULT 60, cron_job_id TEXT, background_task_name TEXT,
        last_tick_at TEXT, last_tick_error TEXT
    )""",
    "INSERT INTO reminder_settings(id) VALUES(1)",
    """CREATE TABLE teacher_todos (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, details TEXT NOT NULL, kind TEXT NOT NULL,
        course_id TEXT REFERENCES courses(id), due_at TEXT NOT NULL, lead_minutes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    """CREATE TABLE reminder_deliveries (
        id TEXT PRIMARY KEY, occurrence_key TEXT NOT NULL UNIQUE,
        event_id TEXT REFERENCES timetable_events(id), todo_id TEXT REFERENCES teacher_todos(id),
        kind TEXT NOT NULL, due_at TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','dispatching','accepted','failed','expired','cancelled')),
        error_code TEXT, receipt_json TEXT NOT NULL DEFAULT '{}', parent_id TEXT REFERENCES reminder_deliveries(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), claimed_at TEXT, finished_at TEXT
    )""",
    "CREATE INDEX reminder_due_index ON reminder_deliveries(state,due_at)",
    "CREATE INDEX todo_due_index ON teacher_todos(status,due_at)",
)
