---
name: teacher-workspace
description: Manage courses and reviewable teaching tasks.
version: 0.1.0
author: yifan4243-sketch
license: MIT
metadata:
  hermes:
    category: education
    tags: [teaching, courses, workflow]
---

# Teacher Workspace Skill

Use the profile-local teaching database through native Hermes tools. Course,
class and student records share the same services as the teacher Desktop.

## When to Use

Create or update a course, associate a class, or prepare a reviewable course
setup task. Resolve existing records before creating duplicates.

## Prerequisites

Enable the `teacher-assistant` plugin and the `teacher` toolset in the current
teacher profile. A missing plugin or denied permission requires configuration
through the teacher workspace.

## How to Run

Read operation schemas with `teacher_records` using `operation="schema"`.
Then call the relevant operation with its validated `data` fields. Every write
needs a stable `request_id`. Reuse that ID with identical input after a lost
response, and use a new ID for a changed command.

## Quick Reference

- `teacher_records` supports `course.list`, `course.get`, `course.create`,
  `course.update`, `class.create`, `class.list`, `class.update`,
  `student.create`, `student.list`, `student.update`, `course.assign_class`,
  `course.classes`, `enrollment.create` and `enrollment.list`.
- `teacher_tasks` supports `task.create`, `task.run`, `task.get`, `task.list`,
  `task.cancel` and `task.retry`.
- A `course.create` payload includes `title` and optional `subject`, `level`,
  `objectives`, `period_minutes`, `period_count` and `break_minutes`.
- A `course.update` payload requires `id`, current `version` and changed fields.
- A `task.create` payload has `kind="course_setup"` and a `course` object.
- `plan.save`, `plan.get` and `plan.list` calculate and persist actual semester
  dates. Read the schema for dates, weekly slots, exclusions and chapter weights.
  Weekdays use Monday=0, Sunday=6; local times currently use Asia/Shanghai.
  Reference real chapters from the chosen textbook version. Omitted chapters
  use top-level chapters, while an explicit selection must contain at least one.
  Recalculation passes the latest plan ID as parent_id and preserves old versions.

## Procedure

1. List existing courses and confirm which course the user's task concerns.
2. Read the operation schema before sending new fields.
3. Use configured student level and learning objectives. Keep course subjects
   configurable and avoid copying the robotics style sample's subject facts.
4. Default to two 40-minute teaching periods and a separate 10-minute break.
   `break_minutes` is the total break time for the course session.
5. A reviewable setup task begins as `pending`. Call `task.run`, then return its
   ID and `awaiting_review` status. The teacher reviews it in Desktop.
6. On a version conflict, refresh and reapply the user's intended change.
7. On a failed task, inspect the error before using `task.retry`.
8. Student access is disabled for Agent tools by default. The teacher must
   grant it explicitly. Keep student information local.
9. Calculate plans only from the teacher's actual semester dates, weekly slots
   and school closures. Distinguish teaching minutes, break time, calendar span
   and independent exam duration. Plan calculation does not activate reminders
   or publish a calendar. Never describe this calculation step as a completed
   scheduling and notification workflow.

## Pitfalls

- Preserve the distinction between 80 instructional minutes and a 90-minute
  calendar span. Breaks contribute zero instructional minutes.
- Treat imported textbooks as source material with traceable references.
- Formal teaching scripts and lesson plans export DOCX only.
- A pending review is a durable waiting state. Report it accurately.
- Never put model credentials in tool payloads, course fields or Git.

## Verification

Re-query the saved course or task and check its persisted ID and version.
For enrollment, verify that the student's class belongs to the course first.
Report any denied permission or unresolved review accurately.
