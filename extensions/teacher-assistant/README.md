# Teacher Agent Pro V5.1

教师业务通过统一插件接入 Hermes Agent 和原生 Desktop。当前已实现基础课程与身份、可审核任务及教材知识库。后续模块的实际状态见 `IMPLEMENTATION_CHECKLIST.md`。

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
- `teacher_knowledge` 导入教材、查询版本与来源、检索和创建关联教材的课次。
- `teacher_preparation` 保存完整教学正文、修订、版本查询及审核后DOCX导出。
- `teacher-assistant:teacher-workspace` 为只读原生 Skill。
- `teacher-assistant:teacher-knowledge` 指导教材导入、来源引用及复核。
- `teacher-assistant:teacher-preparation` 指导逐字稿和原模板教案生成。
- Desktop 使用受原生 Gateway `session:control` 验证的 `plugin.teacher-assistant.call` RPC。
- 教师审核由 Desktop RPC 提交，Agent 工具保留待审核状态。

## 开发入口

```powershell
node extensions/teacher-assistant/scripts/build_desktop.mjs
pnpm --filter hermes exec tsc -p ../../extensions/teacher-assistant/desktop/tsconfig.json --noEmit
pnpm --filter hermes exec playwright test --config ../../extensions/teacher-assistant/desktop/playwright.config.mjs
```

Python 测试使用项目官方 `scripts/run_tests.sh tests/extensions/`。测试环境通过 `pm.testenv.ensure_testenv(Path.cwd(), extras=['all','documents','documents-pdf'])` 准备，显式将管理的测试解释器传给未激活runner的 `HERMES_PYTHON`。测试覆盖真实插件发现、文件解析、Hermes工具、事务、跨进程恢复和审批。模型集成采用本地脚本服务，Desktop使用真实Gateway与SQLite。

## 教材操作

通过“教材知识库”选择课程，填写教材名称并上传PDF、DOCX、PPTX或TXT。新增版本时选择已有教材，原文件及旧版本继续保留。扫描图片等无法直接提取文本的内容会显示解析告警。

选择教材版本后可修订章节、复核知识点并查看原文。全文搜索本地执行。语义检索需在“模型与权限”启用，每次检索还需确认模型调用，会向Hermes当前模型发送查询及最多60条候选教材片段，可能产生费用。

PPT设计图默认由教学内容和Slide Blueprint自动生成，可选主题无需人工参考。提前验证样例位于 `resources/slide-prototype`，编辑与渲染证据位于 `phase2-evidence`。

## 授课稿与教案

在“授课稿与教案”选择课程，创建课次并选取固定教材版本和原文依据。确认本次模型调用后，生成按钮会启动原生Hermes Agent会话。阶段模型通过“模型与权限”配置，凭据沿用原生设置。

Agent先读取教师Skill、完整授课风格范例和教材原文，再保存结构化草稿。返回工作台可阅读全文、逐段修订授课稿、修订教案和查看时间估算。已审核版本保留，修订另建版本。教案关联一个已审核授课稿，活动逐一对应两个40分钟单元。

审核通过后使用“下载正式DOCX”通过原生保存对话框保存文件。文档时间估算还需教师按实际语速试读核验。生成任务保存原生会话入口，状态不明确时打开原会话核查。“取消草稿保存任务”阻止后续正文保存，停止模型调用请使用原生会话的停止按钮。

## 当前交付范围

完整 V5.1 需求与执行授权位于 `resources/requirements`，教案原始模板与完整授课稿范例均已保存。授课逐字稿、教案、教材库、课件、计划、考试和分析等后续业务的完成状态按阶段证据记录。
