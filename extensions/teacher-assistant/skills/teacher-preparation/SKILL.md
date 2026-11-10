---
name: teacher-preparation
description: Draft full teaching scripts and template lesson plans.
version: 0.1.0
author: yifan4243-sketch
license: MIT
metadata:
  hermes:
    tags: [teaching, docx, preparation]
    category: education
---

# Teacher Preparation Skill

使用原生Hermes Agent完成教学文档正文，并通过 `teacher_preparation` 保存可审核版本。完整授课范例保存在插件资源中，每次新备课先读取。

## When to Use

为已绑定教材来源的课次生成授课逐字稿、正式教案或修订其中一个课堂环节时使用。

## Prerequisites

先通过 `teacher_knowledge` 的 `lesson.get` 确认课次，必要时先导入教材并创建课次。

## How to Run

使用 `teacher_preparation` 读取 `document.schema` 了解完整正文结构，读取 `preparation.context` 获得课程目标、课次来源、现有版本和完整课堂语言范例。`preparation.context` 的 `id` 是课次ID。

## Quick Reference

- `document.save` 保存完整逐字稿或教案新版本，写操作使用稳定 `request_id`。
- `document.get` 和 `document.list` 读取正文与版本。
- `document.revise_segment` 仅修订指定单元的一个环节，保留其他正文并创建新版本。
- `document.generation.get` 读取Desktop发起的原生Agent任务状态。
- `document.export` 只生成教师审核通过版本的DOCX。

## Procedure

1. 读取完整范例。借鉴课堂称呼、追问、生活与工业案例、教师动作、板书和互动的组织方式，正文以当前教材为依据。
2. 逐字稿包含两个教学单元，每单元各环节计划时间合计40分钟。课间10分钟由导出器单列，不能写成教学活动。
3. `spoken_text` 写出教师可直接朗读的完整话语，按实际计划时长充分展开。每个环节至少200字是格式下限，时间检查还会根据语速与活动时长计算，200字不能代表完整10分钟讲解。
4. 将非口语活动写入 `teacher_actions`、`student_activity` 和 `blackboard`。`activity_minutes` 只计独立的练习、讨论等时间，不能与朗读时间重复计算。
5. 全课包含导入、讲解、案例、提问、练习、总结和作业，写清教师动作与板书。每段 `source_ids` 必须来自绑定教材。不能编造页码或把范例页码搬入当前课程。
6. 使用 `document.save` 保存kind为script、两个完整units和homework。依据返回的时间告警补充或删减正文，使用最新版本创建修订。
7. 使用 `document.get` 读取本课次已审核授课稿完整正文，将其ID保存为教案的 `script_id`。`activities` 按unit_index和segment_index逐一覆盖授课稿所有环节，时间使用原授课稿分配。
8. 教案填写教学目标、重点、难点、课前准备、教师与学生活动、方法、总结、作业、板书和课程思政。周次或总课时未知时保持待设置。教学反思留给教师课后据实填写。
9. Desktop任务给出generation_id时，保存时带上该ID。先读取任务状态，如果已取消则停止保存，如果已有document_id则读取该文档。任务生成完成后等待教师复核。

## Pitfalls

- 大纲、占位文本和重复凑字不能替代完整可朗读正文。
- 朗读时间是程序估算，教师仍需按实际课堂节奏试读核验。
- 教师审核只能由本地界面提交，Agent不能替代签认。
- 正式教案由原始DOCX模板填充。逐字稿和教案的最终导出格式均为DOCX。

## Verification

重新读取保存版本，检查全文、来源、时间告警及教案对应关系。向教师报告文档ID、版本和待复核事项，不能宣布未经审核的草稿已经成为正式成果。
