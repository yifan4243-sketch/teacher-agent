# V5.1 开发进度

## 当前状态

Phase 1 已完成并提交，当前开始 Phase 2。最近功能提交为 `b2c7484b66`。Phase 0 已由用户验收，交付基线为 `bdbdc35865015135e1ad1ee3f86a4bcef1008e81`。

正式工作区为 `C:\Users\yifan\Desktop\teacher_Agent_dev`，分支为 `teacher/v5.1-foundation`。完整执行授权保存在 `resources/requirements/Teacher_Agent_Pro_V5.1_Execution.txt`。

## 已完成的代码工作

- 新增原生教师 Plugin 注册入口。
- 新增独立 teaching.db 的课程、班级、学生、选课、任务、审批、幂等回执和审计表。
- 新增课程与身份服务、版本校验、事务写入和课程设置任务。
- 新增原生 teacher-workspace Skill。

已完成 TypeScript 工作台源码、原生 SDK 构建与 Windows 安装脚本。Teacher Profile 已实际创建于 `E:\TeacherAgentData\dev-home\profiles\teacher-pro`，教师插件通过目录联接安装并已启用 Agent 端。

新增 Python 行为测试 11 项通过。与提示缓存、插件兼容和 Gateway RPC 回归合计 59 项通过、1 项因 POSIX 平台限制跳过。TypeScript 类型检查和原生 Desktop 端到端测试通过。完整阶段结果见 `PHASE1_REPORT.md`。

## 待完成

实现教材上传、四类文件解析、章节和知识点、来源定位、检索及版本管理，并提前开展可编辑 PPTX 原型。Phase 2–9 的完整范围见 `IMPLEMENTATION_CHECKLIST.md`。

## 最近成功测试

`phase1-final-regression.log` 为 59 通过、0 失败、1 跳过，`desktop-acceptance-configured.log` 为 1 项真实 Desktop 业务测试通过。`desktop-typecheck-final.log` 成功退出。原始日志位于 `E:\TeacherAgentData\phase1-evidence`。

## 恢复入口

先读取正式需求、执行授权、本文件和 Git 状态。Desktop 测试入口为 `pnpm --filter hermes exec playwright test --config ../../extensions/teacher-assistant/desktop/playwright.config.mjs`。统一插件的 Desktop 半部按原生约定默认关闭，测试需在“技能与工具 → 插件”通过原生开关启用，Agent 半部已在测试配置中启用。测试 Python 应使用 `pm.testenv.testenv_python` 解析的管理环境，基础 Python 无法在新临时 home 直接启动 Gateway。

上述测试和仓库检查均已成功结束。继续 Phase 2 时，先为教师插件声明文档解析和 Office 导出依赖，再通过 Hermes PM 准备插件运行及测试环境。用户真实课件设计图已通过异步问题请求，暂未收到回复。
