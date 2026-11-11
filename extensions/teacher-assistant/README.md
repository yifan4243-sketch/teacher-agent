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

启用后，“教师工作台”固定显示在左侧“消息平台”下方。启用状态由原生Desktop保存，后续直接点击侧边栏入口即可进入。

## 数据与操作

教学数据保存在当前 Hermes profile 的 `plugin-data/teacher-assistant/teaching.db`。课程、班级与学生资料的写操作具有请求幂等回执和修改审计。更新记录需要当前版本号，归档保留历史记录。

学生资料默认供本地教师界面使用。教师可在“模型与权限”页授权 Agent 访问，或禁用具体 Agent 操作。Agent 工具的权限限制同样约束课程设置任务。

默认课次包含两个40分钟教学小节，休息合计10分钟，实际教学80分钟、日历跨度90分钟。课程设置允许修改这些参数，单小节课程的休息分钟数设为0。

## 原生接口

- `teacher_records` 管理课程、班级与学生课程关联，`schema` 返回具体字段。
- `teacher_tasks` 创建、执行、查询、重试或取消教学任务。
- `teacher_knowledge` 导入教材、查询版本与来源、检索和创建关联教材的课次。
- `teacher_preparation` 保存完整教学正文、修订、版本查询及审核后DOCX导出。
- `teacher_slides` 读取可选主题与按蓝图自动合成的单页生图提示词。
- `teacher-assistant:teacher-workspace` 为只读原生 Skill。
- `teacher-assistant:teacher-knowledge` 指导教材导入、来源引用及复核。
- `teacher-assistant:teacher-preparation` 指导逐字稿和原模板教案生成。
- `teacher-assistant:teacher-slide-design` 指导有来源的教学页面蓝图。
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

## 课件页面蓝图

在“课件页面蓝图”选择已完成授课稿和教案审核的课次，确认模型调用后由原生Agent规划页面。蓝图绑定已审核文档的固定版本和实际教材知识点，每页与授课稿环节对应。

可按页修订标题、准确可见文字、备注和布局，选择简洁、科技、蓝白或深色主题，查看自动合成的单页生图提示词。审核保存蓝图版本后，后续图片与可编辑PPTX继续沿同一版本关联实现。图片执行、缓存、预算和可编辑还原的完成状态见实施清单。

审核蓝图后，下方图片工作区可设置预算和单页估算，授权并预留页面任务，再单页或依次执行。服务选择和凭据在Hermes原生设置中管理。设计图可预览、下载、重新生成和核对，原图与16比9留边版分别保留。

完成文字与布局识别后，先审核设计图，再在“图片转可编辑课件”选择识别任务建立页面。可修改文字、位置、字号、颜色、表格单元格和图片裁切区域，保存为新版本。单页草稿PPTX可下载核对，正式单页需页面审核。完整PPTX按每页最新已审核版本组装，缺页会指出具体页号。渲染预览与自动修复的进展见实施清单。

页面下方“实际渲染与设计图对照”可选择运行Hermes的Windows主机上已安装的WPS或PowerPoint，生成实际PNG，并同时查看原始设计图和像素差异。可下载原始分辨率PNG，历史结果按页面版本保留。当前WPS 12.0已经实机验证，PowerPoint待对应环境验证。

## 答卷识别与校对

在“答卷与成绩”选择已审核试卷和已选课学生，上传PNG、JPEG、WEBP或扫描PDF。单文件最大50MB，PDF最多200页。原件及每页图像保留SHA-256，预览和后续批改报告均关联来源。

设置该文件识别预算、页号范围和每页费用估算，明确授权发送所选页面后预留任务，再运行已选任务。视觉模型沿用“模型与权限”中的批改阶段配置，需要支持图片输入。参考答案和评分标准在转录请求中省略，模型依据页面作答进行识别。相同页面和模型的成功结果可以复用，重新识别会创建新的计费任务。

每页选择一份成功结果，合并后对照原页检查文字、置信度、缺题、跨页和冲突提示。逐题编辑答案并勾选校对确认后保存，系统另存答卷版本及识别任务来源。随后计算评分草稿，复核主观题要点并发布正式成绩。批改报告包含原件文件名、页号与哈希。

执行中取消可能仍产生服务费用，界面需确认此事实。预算按估算预留，服务回执存在时更新，实际结算以服务商账单为准。进程中断后保留已记录状态，核查任务后可取消并重新预留。本机集成测试使用模拟视觉服务，真实识别质量待模型联调。

## 当前交付范围

完整 V5.1 需求与执行授权位于 `resources/requirements`，教案原始模板与完整授课稿范例均已保存。授课逐字稿、教案、教材库、课件、计划、考试和分析等后续业务的完成状态按阶段证据记录。
