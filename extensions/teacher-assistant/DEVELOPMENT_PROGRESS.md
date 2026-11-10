# V5.1 开发进度

## 当前状态

Phase 2 已提交并推送，SHA为 `0d1f63156b03bfb7299cb6a99947b2f14ec1fad7`，远端分支核验一致。当前完成Phase 3文档与原生Agent入口，进行最终测试、记录和提交。Phase 0 已由用户验收，交付基线为 `bdbdc35865015135e1ad1ee3f86a4bcef1008e81`。

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

下一步进入Phase 4，实现完整Slide Blueprint、内容关联、可选主题、逐页图片生成和预算与缓存。Phase 4–9 的完整范围见 `IMPLEMENTATION_CHECKLIST.md`，所有模块继续保留。

## 最近成功测试

Phase 2 的 `teacher-regression-final.log` 为24通过、0失败。`desktop-knowledge-retry.log` 为1项真实Electron、Gateway与SQLite端到端测试通过，包含上传、检索、教师复核、章节修订及刷新持久性。TypeScript成功退出。原始日志位于 `E:\TeacherAgentData\phase2-evidence`。Phase 1 的59通过、1平台跳过记录继续保留。

Phase 3教师测试27项通过。文档及原生回归51项通过、1项POSIX跳过，其中3项文档测试与教师测试重复，独立合计75项通过。Desktop的原生Skill加载、Agent保存、两类文档修订为v2、审核、真实下载和SHA-256核验通过。WPS实际渲染技术样例为14页逐字稿和2页模板教案，正文采用明确标注的模拟文本。原始证据位于 `E:\TeacherAgentData\phase3-evidence`。

## 恢复入口

先读取正式需求、执行授权、本文件和 Git 状态。Desktop 测试入口为 `pnpm --filter hermes exec playwright test --config ../../extensions/teacher-assistant/desktop/playwright.config.mjs`。统一插件的 Desktop 半部按原生约定默认关闭，测试需在“技能与工具 → 插件”通过原生开关启用，Agent 半部已在测试配置中启用。测试 Python 应使用 `pm.testenv.testenv_python` 解析的管理环境，基础 Python 无法在新临时 home 直接启动 Gateway。

管理测试环境必须包含 `all`、`documents` 和 `documents-pdf` extras。原生 `all` 不含文档依赖，运行环境的PYTHONPATH会被测试运行器清除。已通过 `pm.testenv.ensure_testenv` 构建独立环境，并通过官方runner的显式 `HERMES_PYTHON` 入口运行。

用户已明确无需提供固定PPT样式图，禁止等待人工参考。正式路线为教材与教学成果→Slide Blueprint→AI逐页设计图片→可编辑PPTX。可选主题独立于人工参考图。测试图片已由系统生成并保存在 `resources/slide-prototype`。
