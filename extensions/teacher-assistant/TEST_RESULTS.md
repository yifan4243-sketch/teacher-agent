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

## Phase 2

官方runner执行教材、基础和PPTX测试共24项通过、0失败。TypeScript类型检查成功。真实Desktop端到端1项通过，包含真实上传、版本与来源检索、教师复核、章节修订及重载。WPS原生编辑和保存后重读核验通过，PPTX位图为0。

另跑原生提示缓存、插件兼容及Gateway RPC回归48项通过、1项POSIX跳过，合计Python72项通过、0失败。原生插件校验与仓库15项检查通过。

语义扩词与重排、视觉布局适配器采用模拟模型响应，真实外部模型联调待授权。PPT输入图由实际生图工具生成，当前重建布局为开发者视觉测量，自动流水线仍需Phase 4–5联调。

初次依赖失败及Desktop冷启动超时保留于外部日志目录，修复后最终回归通过。证据见 `phase2-evidence` 和 `PHASE2_REPORT.md`。
