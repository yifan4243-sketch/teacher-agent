"""Answer, draft and official grade history stay separate and source-linked."""

SCHEMA = (
    """CREATE TABLE answer_submissions (
        id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES answer_submissions(id),
        parent_id TEXT REFERENCES answer_submissions(id), version INTEGER NOT NULL,
        paper_id TEXT NOT NULL REFERENCES exam_papers(id), student_id TEXT NOT NULL REFERENCES students(id),
        class_id TEXT NOT NULL REFERENCES classes(id), answers_json TEXT NOT NULL, note TEXT NOT NULL, created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(paper_id,student_id,version)
    )""",
    """CREATE TABLE grade_drafts (
        id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES answer_submissions(id), version INTEGER NOT NULL,
        parent_id TEXT REFERENCES grade_drafts(id), report_json TEXT NOT NULL, created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(submission_id,version)
    )""",
    """CREATE TABLE grade_publications (
        id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES exam_papers(id), student_id TEXT NOT NULL REFERENCES students(id),
        class_id TEXT NOT NULL REFERENCES classes(id), submission_id TEXT NOT NULL REFERENCES answer_submissions(id),
        draft_id TEXT NOT NULL UNIQUE REFERENCES grade_drafts(id), previous_id TEXT REFERENCES grade_publications(id),
        total_points_centi INTEGER NOT NULL CHECK(total_points_centi>=0), scores_json TEXT NOT NULL,
        note TEXT NOT NULL, reviewed_by TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )""",
    "CREATE UNIQUE INDEX grade_current_student_paper ON grade_publications(student_id,paper_id) WHERE active=1",
    """CREATE TABLE grade_wrong_questions (
        grade_id TEXT NOT NULL REFERENCES grade_publications(id), question_id TEXT NOT NULL REFERENCES question_versions(id),
        lost_points_centi INTEGER NOT NULL CHECK(lost_points_centi>0), PRIMARY KEY(grade_id,question_id)
    )""",
    """CREATE TABLE grading_generations (
        workflow_id TEXT PRIMARY KEY REFERENCES workflows(id), base_draft_id TEXT NOT NULL REFERENCES grade_drafts(id),
        prompt TEXT NOT NULL, model_json TEXT NOT NULL, runtime_session_id TEXT, stored_session_id TEXT,
        result_draft_id TEXT REFERENCES grade_drafts(id)
    )""",
)
