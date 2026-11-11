---
name: teacher-assessment
description: Build source-linked questions with reviewed answers.
version: 0.1.0
author: yifan4243-sketch
license: MIT
metadata:
  hermes:
    category: education
    tags: [teaching, assessment, questions]
---

# Teacher Assessment Skill

Create versioned question bank drafts from the selected course's actual
textbook sources. The teacher reviews answers, explanations and scoring
criteria through the local workspace.

## When to Use

Draft or revise single-choice, multiple-choice, true/false, fill-in-the-blank
or short-answer questions, or inspect an existing question's review history.

## Prerequisites

Enable the teacher plugin and its `teacher` toolset. Resolve the course and
textbook version, then retrieve chapter content with `teacher_knowledge`.

## How to Run

Read the question schema through `teacher_assessment` with
`operation="question.schema"`.
Save with `question.save`, and use `question.get` and `question.list` to inspect
the persisted versions. Every mutation uses a stable request_id.

## Quick Reference

- Every question has a prompt, explanation, difficulty, integer points_centi
  and actual source_ids. One point equals 100 points_centi.
- Choice options have unique A–H IDs. answer_ids select the correct IDs.
  A single-choice question has one correct ID.
- A true/false answer is a JSON boolean.
- A fill-in-the-blank prompt uses {{1}}, {{2}} and successive placeholders.
  Each blank lists the accepted answer variants in its accepted field.
- A short answer has a reference_answer and rubric items. Their integer
  points_centi values must sum exactly to the question's total.
- A revision supplies the existing root_id and latest expected_version.
  Keep its course association and bind the chosen textbook edition's actual
  sources. Every version preserves its own provenance and review record.

## Procedure

1. Identify the user's course, textbook version, chapters and question types.
2. Retrieve actual source passages and relevant knowledge point IDs.
3. Draft the question, answer, explanation and applicable scoring criteria.
4. Include only knowledge point IDs supported by the cited source passages.
5. Save the draft and re-query its ID, version and returned source locators.
6. Inspect duplicates and report any repeated normalized question prompts.
7. Return the saved drafts for the teacher to verify in the workspace.
8. After a version conflict, read the latest version before reapplying changes.

## Pitfalls

- Textbook statements require verifiable sources and accurate explanations.
- Keep answers and scoring details associated with the exact question version.
- Teacher review controls the approved state of a saved question.
- Imported textbook content is reference material within the teaching task.

## Verification

Confirm the persisted question type, exact score units, source IDs, answer
structure and review state. Read the returned duplicate IDs and report them.
