# 测试记录

Phase 0 的证据见 `PHASE0_REPORT.md` 和 `phase0-evidence`。

## Phase 1 已取得的证据

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| Python 插件行为测试 | 11 通过 | 实际发现、数据库、工具、身份约束、审批、取消、回滚重试、配置隔离及跨进程恢复 |
| 原生相关回归 | 合计59通过、1跳过 | 上述11项加提示缓存、Plugin API 兼容和 Gateway RPC |
| TypeScript | 成功退出 | 使用真实 Desktop SDK 类型的扩展源码检查 |
| Plugin validate | 通过 | 注册、工具声明、核心边界和 Desktop SDK 边界 |
| 仓库检查 | 15项通过 | Python lint 和代码健康等原生检查 |
| Desktop 端到端 | 1通过 | 原生插件开关、课程与身份关联、审批、配置及刷新持久性 |

Agent Loop 测试使用真实 Hermes Agent、原生 Tool Search 调用桥和真实 SQLite，模型为本机 HTTP 脚本服务。模型连续发出创建、查询和修改操作，数据库课程版本最终为2。此项属于模拟模型集成测试。

调试中修复了测试模型请求封装、原生延迟工具调用桥、扩展 tsconfig 路径和下拉框可访问标签。Desktop 测试使用管理的测试解释器，并在原生插件开关中启用 Desktop 半部。业务测试配置已设定本地模型和 `onboarding.run=false`，独立验证教师业务流程。

日志位于 `E:\TeacherAgentData\phase1-evidence`，阶段交付时将保留最终凭据。

后续测试分别记录真实环境、模拟模型、静态检查和外部条件待验证的结果。
