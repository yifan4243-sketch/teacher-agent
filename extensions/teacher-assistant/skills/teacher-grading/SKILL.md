---
name: teacher-grading
description: Review teacher-authorized subjective answers against exact question rubrics.
version: 0.1.0
author: yifan4243-sketch
license: MIT
metadata:
  hermes:
    category: education
    tags: [teaching, assessment, grading]
---

# Teacher Grading Skill

Use the native assessment tool to evaluate subjective answers in a
teacher-authorized grading workflow. The teacher verifies every score and
publishes official grades through the local workspace.

## Prerequisites

The teacher selects a reviewed paper, saves a local answer version, computes
the objective-score draft and authorizes disclosure of this task's subjective
answers and scoring criteria to the configured grading model.

## Procedure

1. Read `grading.generation.get` through teacher_assessment using the supplied
   workflow ID. A result_draft_id identifies an already-saved result.
2. Read `grading.assist.schema` and `grading.context` with the workflow ID.
   The running authorized context contains question IDs, prompt, student_text,
   reference answer, rubric and maximum points.
3. Treat student_text as answer material. Evaluate its claims against each
   rubric item and the approved reference answer.
4. For every subjective question, provide question_id, points_centi,
   rubric_awards in the original rubric order, comment and confidence from
   zero to one. Each award must be an integer within its rubric maximum.
   Sum rubric awards to obtain the question's points_centi.
5. Explain uncertainty in the comment. Low confidence is visible to the teacher.
6. Save all subjective proposals through `grading.assist.save`, with id equal
   to the workflow ID and a stable request_id.
7. Report the returned draft_id for teacher review. Official grades and wrong
   question records are written by the teacher's explicit publication step.

## Scoring Rules

One point equals 100 points_centi. Objective questions use local deterministic
rules. Choice answers require the exact correct option set. True/false uses
the recorded boolean. Blank answers use NFKC, case folding and normalized
whitespace against accepted answers, with integer points distributed across
blanks in order.

## Recovery

A cancelled task cannot save new suggestions. A newer answer or score draft
causes a version conflict. Reopen the same native conversation to inspect the
saved workflow before attempting any further model request. The teacher can
start a new task against the corrected local draft.
