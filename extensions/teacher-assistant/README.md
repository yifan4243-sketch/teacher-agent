# Teacher Agent Pro V5.1

教师业务通过统一插件接入 Hermes Agent 和原生 Desktop。当前已实现 Phase 1 的课程、班级、学生身份、选课关联与可审核课程任务。后续模块的实际状态见 `IMPLEMENTATION_CHECKLIST.md`。

## 本机安装

在 Hermes 开发环境激活后，于仓库根目录的 PowerShell 执行。

```powershell
. .\activate.ps1
.\extensions\teacher-assistant\scripts\setup.ps1
```

默认创建原生 `teacher-pro` 配置档案，使用 NTFS 目录联接加载本目录，并启用 Agent 端教师插件。已有的同名其他安装会使脚本停止并显示位置。

Desktop 首次进入“技能与工具 → 插件”，启用“教师专业工作台”。在原生配置档案选择器中选择 `teacher-pro`，通过“教师工作台”导航管理教学资料。模型凭据通过 Hermes 原生系统设置配置，教师页面保存各阶段模型名称和工具权限。

## 数据与操作

教学数据保存在当前 Hermes profile 的 `plugin-data/teacher-assistant/teaching.db`。课程、班级与学生资料的写操作具有请求幂等回执和修改审计。更新记录需要当前版本号，归档保留历史记录。

学生资料默认供本地教师界面使用。教师可在“模型与权限”页授权 Agent 访问，或禁用具体 Agent 操作。Agent 工具的权限限制同样约束课程设置任务。

默认课次包含两个40分钟教学小节，休息合计10分钟，实际教学80分钟、日历跨度90分钟。课程设置允许修改这些参数，单小节课程的休息分钟数设为0。

## 原生接口

- `teacher_records` 管理课程、班级与学生课程关联，`schema` 返回具体字段。
- `teacher_tasks` 创建、执行、查询、重试或取消教学任务。
- `teacher-assistant:teacher-workspace` 为只读原生 Skill。
- Desktop 使用受原生 Gateway `session:control` 验证的 `plugin.teacher-assistant.call` RPC。
- 教师审核由 Desktop RPC 提交，Agent 工具保留待审核状态。

## 开发入口

```powershell
node extensions/teacher-assistant/scripts/build_desktop.mjs
pnpm --filter hermes exec tsc -p ../../extensions/teacher-assistant/desktop/tsconfig.json --noEmit
pnpm --filter hermes exec playwright test --config ../../extensions/teacher-assistant/desktop/playwright.config.mjs
```

Python 测试使用项目官方 `scripts/run_tests.sh tests/extensions/test_teacher_foundation.py`。测试覆盖真实插件发现、Hermes 工具调用、事务、跨进程恢复和审批。Agent 集成测试的模型为本地脚本服务，Desktop 使用真实 Gateway 与 SQLite。

## 当前交付范围

完整 V5.1 需求与执行授权位于 `resources/requirements`，教案原始模板与完整授课稿范例均已保存。授课逐字稿、教案、教材库、课件、计划、考试和分析等后续业务的完成状态按阶段证据记录。
