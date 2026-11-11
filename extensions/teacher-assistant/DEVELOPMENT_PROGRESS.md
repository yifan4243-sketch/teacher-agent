# V5.1 开发进度

## 当前状态

Phase 7命题与试卷模块已实现，schema 19。命题范围及已授快照、题型/难度/分值/覆盖检查、原生Agent生成任务、题库组卷、不可变试卷版本、教师审核及学生/教师版DOCX/PDF已通过后端和真实Desktop链路验证。完整教师回归72项，命题补充定向4项通过。新增页面的Agent生成结果刷新问题已修复。见PHASE7_EXAMS_CHECKPOINT.md。下一步继续评分、识别复核、正式成绩与错题，再到Phase 8–9。真实模型质量及Phase 5剩余范围继续保留。当前基线为895f0e4c2e7790f580cf3e74e3289838c264dea0，命题模块提交与同步见Git历史。

Phase 7题库基础模块已实现，schema 18。五类题型、教材原文/知识点关联、跨教材版本修订、旧稿审核、重复提示、原生teacher_assessment Tool/Skill及真实Desktop已通过验证。最终完整教师回归68项在关闭文件重试时一次通过，最后补充定向3项及真实跨教材版本界面回归通过。见PHASE7_QUESTIONS_CHECKPOINT.md。下一步继续命题配置与生成任务、试卷和批改。Phase 8–9完整范围继续保留。后台配置锁与输入模型修复提交为`601cdaa2b92fb63f20c6a60b8940e2a24c78dd3c`，题库模块提交与同步凭据见Git历史。

Phase 6代码与阶段验证完成，schema 17。最后增量加入人工章节进度/课次顺序调整、课间与下课提醒、PPT准备状态及旧回执兼容。完整教师回归64项、补充定向9项、原生Skill入口1项及真实Desktop通过，见PHASE6_REPORT.md。下一步进入Phase 7题库与试卷。已同步提醒基础提交为`117b30cad26be655dbff2a81fe12aec28b4ae363`，阶段收尾提交见Git历史。Phase 5复杂视觉修复、真实模型质量及Phase 7–9完整范围继续保留。

Phase 6提醒与待办已实现，schema 16，真实Windows任务在Desktop关闭时调用Hermes原生无模型cron，成功发送通知并核对系统历史。教师回归62项、补充定向5项、真实Desktop、TypeScript和插件验证通过，详见PHASE6_REMINDERS_CHECKPOINT.md。当前继续人工章节进度调整，再按依赖实施Phase 7–9。上一已同步提交为`338196521b824fba08c9e2a6b95d25bb5e868262`，本模块提交凭据见Git历史。

Phase 6计划DOCX/XLSX/PDF导出已实现，schema 15，支持全学期/月份/教学周和未发布/已发布/历史标注。教师回归57项、真实Desktop原生下载、WPS文字/表格及PDF逐页渲染通过，见PHASE6_PLAN_EXPORT_CHECKPOINT.md。下一步是原生调度与Windows提醒、个人待办及更细粒度内容调整；Phase 6仍未整体完成。上一已同步提交 `8d3d5abe4b0e54c4aaf34c461544fdb6de4d6540`，本模块凭据见Git历史。

Phase 6实际课表增量已实现，schema 14。支持计划审核发布、跨课程冲突、旧发布快照、兼容计划版本保留调课与进度、日/周/月日历、授课登记与审计。完整教师回归55项、补充定向3项及真实Desktop通过，见PHASE6_TIMETABLE_CHECKPOINT.md。下一步是原生调度与Windows提醒、个人待办及计划导出；整个Phase 6尚未完成。上一已同步提交 `33ce8497526b369a39a3716c6d89d150e3c666e4`，本增量凭据见Git历史。

当前进入Phase 6首个模块：学期实际日期、章节难度课时分配、独立考核时长、周/月查看与版本保存已实现，schema 13。教师回归52项及真实Desktop通过，详见PHASE6_PLANNING_CHECKPOINT.md。下一步是计划发布与课表/调课/进度，再到提醒和计划导出；Phase 6并未整体完成。上一已同步提交为 `d58dc79ce0e44b07c1e2146180bc7cb04d7f2e1e`，本模块提交凭据见Git历史。Phase 5复杂视觉修复及模型质量待验证，Phase 7–9完整范围保留。

Phase 4可选参考素材已实现，schema 12。支持本地上传/预览/归档、独立外发授权、原生生图参数和缓存隔离；默认仍无需参考图。最新完整教师回归50项通过，真实Desktop通过。已推送备用模式基线为 `295243b27a506f48357b5266bdf271184172ed53`，本增量提交见Git历史。继续Phase 5更广泛元素/布局修复和Phase 6–9，真实模型质量待授权联调。

Phase 5结构化备用模式已接入原生Tool、Skill及Desktop，schema 11。整套草稿、逐页审核、真实WPS渲染和完整PPTX下载通过，当前继续Phase 4可选素材及Phase 5剩余能力，再按依赖推进Phase 6–9。上一同步提交 `49561ff88b7b9b7a1e53fd7494b584282865a44e`，本增量凭据见Git历史。

最新增量为Phase 5实测文字字号适配，schema 10。文字框和表格单元格均以实际Office测量及蓝图规定尺寸判定超框；修复另存草稿并重新渲染。当前继续结构化备用模式、Phase 4可选素材及后续Phase 6–9，未将完整专业版标记交付。上一已推送基线为 `c627618c3c9ed908037fb9a377e8c6894ef727f3`，本次提交以Git历史为准。

Phase 3 已提交并推送，SHA为 `cdef9071df842eb01462c2663ea33c210366d4c8`，远端分支核验一致。Phase 2提交为 `0d1f63156b03bfb7299cb6a99947b2f14ec1fad7`。当前在Phase 4，完成页面蓝图与自动提示词的首个模块，图片生成、缓存、成本预算及视觉核验继续开发。Phase 0 已由用户验收，交付基线为 `bdbdc35865015135e1ad1ee3f86a4bcef1008e81`。

正式工作区为 `C:\Users\yifan\Desktop\teacher_Agent_dev`，分支为 `teacher/v5.1-foundation`。完整执行授权保存在 `resources/requirements/Teacher_Agent_Pro_V5.1_Execution.txt`。

## 已完成的代码工作

- 新增原生教师 Plugin 注册入口。
- 新增独立 teaching.db 的课程、班级、学生、选课、任务、审批、幂等回执和审计表。
- 新增课程与身份服务、版本校验、事务写入和课程设置任务。
- 新增原生 teacher-workspace Skill。

已完成 TypeScript 工作台源码、原生 SDK 构建与 Windows 安装脚本。Teacher Profile 已实际创建于 `E:\TeacherAgentData\dev-home\profiles\teacher-pro`，教师插件通过目录联接安装并已启用 Agent 端。

新增 Python 行为测试 11 项通过。与提示缓存、插件兼容和 Gateway RPC 回归合计 59 项通过、1 项因 POSIX 平台限制跳过。TypeScript 类型检查和原生 Desktop 端到端测试通过。完整阶段结果见 `PHASE1_REPORT.md`。

## 待完成

Phase 2 已实现分块上传、PDF/DOCX/PPTX/TXT实际解析、不可变版本、章节、知识点候选复核、真实来源、全文检索及按需模型同义词扩展与重排。新增课次与教材版本、原文来源关联，供后续教学成果复用。

PPTX 提前原型采用系统实际生成的设计图片，开发者测量布局后由通用渲染器生成32个原生对象。WPS实际修改标题、移动形状、编辑表格并保存后，重读核验成功，位图对象为0。视觉布局模型适配器只有模拟测试，不能当作全自动流水线联调通过。

Phase 3 已加入完整正文结构、两个40分钟单元、独立10分钟休息、语速与活动时长估算、来源校验、分段修订、原模板教案、版本审核和仅DOCX导出。生成入口使用原生Hermes会话、Tool Search、Skill及Agent Loop，模型使用阶段配置或当前默认配置。生成记录绑定原生会话，保存后的文档与任务审批状态关联。

Desktop已增加教材关联课次、生成任务、正文阅读、逐段修订、教案修订、教师审核和原生文件下载。模型使用本机脚本服务进行集成测试，不能当作真实付费模型教学质量验收。模板内容行从固定高度改为最小高度，保留原表格、列宽与页边距，避免长正文截断。

Phase 4已实现版本化Slide Blueprint、四种可选主题、逐页内容密度和两个40分钟时间校验、教材知识点和授课稿环节覆盖校验。蓝图绑定确定的已审核授课稿与教案版本，单页提示词自动合成教材、正文、目标、重点难点和页面用途。原生Agent可保存蓝图，Desktop可逐页修订、查看提示词、审核新版本。schema 4同时兼容schema 3的文档幂等回执。

Phase 4图片模块已接入原生image_generate、预算预留、持久认领、缓存、取消、高清原图、16比9等比留边版本、Desktop预览与下载、单页重做和教师审核。独立视觉提取与蓝图文字比对复用相同费用和任务机制，并保留布局用于后续可编辑PPTX。图片提供者和视觉响应仍通过离线服务验证，真实模型质量验收待授权。

下一步继续可选参考素材管理、Phase 4真实服务条件记录和Phase 5多页可编辑重建、页面修订、渲染与差异修复。Phase 4–9 的完整范围见 `IMPLEMENTATION_CHECKLIST.md`，所有模块继续保留。

提前PPTX原型现已扩展为schema 8持久页面、对象修订、版本审核、单页草稿及正式导出和完整课件导出。导出复用已完成的视觉布局，正式课件逐页采用最新已审核版本。Desktop可编辑文字、位置、颜色和表格单元格，实际文件经原生下载和本机WPS编辑、渲染、保存后重读验证。生产渲染预览、差异与自动修复继续开发，真实模型质量仍待联调。

独立图片区域现已接入元素模型和Desktop。导出核对真实设计图来源，仅嵌入指定裁切区域，可修改原图裁切和目标位置、大小。已有四类元素布局继续支持，重新识别可由教师显式另计费用。图片面积采用小于90%的当前实现约束，见PHASE5_IMAGE_REGIONS_CHECKPOINT.md。渲染预览、差异、修复和结构化备用路线继续实施。

schema 9已接入实际办公软件渲染任务、历史记录、三图对照、RGB绝对差指标和PNG下载。WPS 12.0已通过原生Desktop完整链路验证，使用独立PPTX副本保持输入文件哈希。公开入口查找PowerShell，PowerPoint适配器待对应环境验证。自动修复、结构化备用路线和真实模型质量继续实施。

## 最近成功测试

题库增量完整教师回归16文件68项通过，禁用文件自动重试。最后补充定向3项通过原生schema、教材版本变化、章节和旧稿审核。真实Desktop保存五类题型6个版本、跨教材修订、审核、精确分值和输入校验，刷新持久性通过。初期回归失败与修复记录分别保留，见题库检查点和Phase 6并行修复说明。

Phase 6最终完整教师回归15文件64项通过，最后定向9项及原生Skill入口1项通过。真实Desktop调整并发布v3计划、保留调课与实际70分钟、下载含新内容的XLSX，课件准备状态、课间/下课设置、待办和系统通知历史核对通过。最终界面版式回归记录见phase6-evidence/final。

提醒增量完整教师回归15文件62项通过，最终补充定向5项通过。真实Desktop完成待办创建、改期、完成、取消旧提醒、设置持久性和Windows通知历史核对。独立Profile实机后台已在未启动Desktop时按分钟触发原生cron并发送成功，测试任务已停用。仓库检查与插件验证凭据见提醒增量报告。

计划导出完整教师回归14文件57项通过，最终版式/范围/历史状态定向2项通过。Desktop原生下载DOCX/XLSX/PDF及周计划XLSX，核对9/2课次和640教学/120考核分钟。生产生成器的最终样例经WPS文字、表格和原生PDF渲染，分别为1/2/1页，逐页检查后修正了默认标题蓝线和PDF孤立末行。

课表增量完整教师回归13文件55项通过，补充定向3项通过。真实Desktop发布9课次，将第一课调至次日10:00–11:30并保持40+10+40，教师登记实际70分钟，偏差−10分钟；日/月视图、备课关联、两条修改记录与刷新持久性通过。首轮发现React重复key残留旧结果，修复和新增断言后完整回归通过。

Phase 6计划计算加入后，完整教师回归12文件52项通过。真实Desktop以虚构校历配置计算8课次，去除停课日后重算9课次，教学、休息、日历及独立考核时长分别核对，旧版本可切回，周/月视图与SQLite一致。本模块不调用模型。

可选参考素材加入后，教师回归11文件50项通过，跨蓝图补充案例定向2项通过。真实Desktop通过本地上传/预览、明确授权预留、取消和归档，本用例参考图外发0次。原生image_url实际参数、动态能力、哈希及缓存由离线边界测试验证，不能当作真实模型效果验收。

结构化备用模式加入后，教师回归10文件48项通过。真实Desktop生成并逐页审核8页，WPS渲染首张结构化页面超框/缺测0，整套下载重读核对0位图及SHA-256。旧schema带页面父子版本、审核、渲染、修复及导出记录的升级与注入失败回滚通过。见 `PHASE5_TEMPLATES_CHECKPOINT.md`。

本次完整教师回归9文件45项通过。真实Desktop/WPS验证标题超框1→0、表格单元格超框9→0；每次测量16区域，缺测0，审核v3保持不变，修复追加v5及v7草稿。详见 `PHASE5_TEXT_FIT_CHECKPOINT.md` 和 `phase5-evidence/text-fit`。

Phase 2 的 `teacher-regression-final.log` 为24通过、0失败。`desktop-knowledge-retry.log` 为1项真实Electron、Gateway与SQLite端到端测试通过，包含上传、检索、教师复核、章节修订及刷新持久性。TypeScript成功退出。原始日志位于 `E:\TeacherAgentData\phase2-evidence`。Phase 1 的59通过、1平台跳过记录继续保留。

Phase 3教师测试27项通过。文档及原生回归51项通过、1项POSIX跳过，其中3项文档测试与教师测试重复，独立合计75项通过。Desktop的原生Skill加载、Agent保存、两类文档修订为v2、审核、真实下载和SHA-256核验通过。WPS实际渲染技术样例为14页逐字稿和2页模板教案，正文采用明确标注的模拟文本。原始证据位于 `E:\TeacherAgentData\phase3-evidence`。

Phase 4首个模块的蓝图与文档测试5项通过。Desktop蓝图集成1项通过，包含前述全部教材和文档链路，再经原生Skill/Agent生成8页蓝图、修订为v2、切换科技主题、核对生图提示词和审核。模型仍为本机模拟服务，未触发付费生图。原始日志位于 `E:\TeacherAgentData\phase4-evidence`。

图片任务模块加入后，完整教师插件35项通过。TypeScript、插件校验和仓库15项检查通过。最终Desktop回归通过批量生图分发、独立视觉提取、差异提示、高清下载与哈希、教师复核、缓存和取消，输入为系统曾实际生成的图片，服务响应来自离线测试提供者。完整记录见 `PHASE4_IMAGES_CHECKPOINT.md`。

可编辑集成模块加入后，完整教师插件38项通过。Desktop已通过布局导入、v2文字修订、页面审核、真实PPTX下载、32个原生对象与0位图核验，以及完整课件缺页拦截。WPS进一步验证标题、圆形和表格的实际编辑与另存，证据见 `PHASE5_RECONSTRUCTION_CHECKPOINT.md`。

加入独立图片与实际渲染后，完整教师插件42项通过。Desktop通过含裁切图片的v3页面、WPS真实渲染、原图与差异对照、原生PNG下载和哈希核验，详见PHASE5_IMAGE_REGIONS_CHECKPOINT.md及PHASE5_RENDER_PREVIEW_CHECKPOINT.md。

## 恢复入口

先读取正式需求、执行授权、本文件和 Git 状态。Desktop 测试入口为 `pnpm --filter hermes exec playwright test --config ../../extensions/teacher-assistant/desktop/playwright.config.mjs`。统一插件的 Desktop 半部按原生约定默认关闭，测试需在“技能与工具 → 插件”通过原生开关启用，Agent 半部已在测试配置中启用。测试 Python 应使用 `pm.testenv.testenv_python` 解析的管理环境，基础 Python 无法在新临时 home 直接启动 Gateway。

管理测试环境必须包含 `all`、`documents` 和 `documents-pdf` extras。原生 `all` 不含文档依赖，运行环境的PYTHONPATH会被测试运行器清除。已通过 `pm.testenv.ensure_testenv` 构建独立环境，并通过官方runner的显式 `HERMES_PYTHON` 入口运行。

用户已明确无需提供固定PPT样式图，禁止等待人工参考。正式路线为教材与教学成果→Slide Blueprint→AI逐页设计图片→可编辑PPTX。可选主题独立于人工参考图。测试图片已由系统生成并保存在 `resources/slide-prototype`。
