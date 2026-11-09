# Teacher Agent Pro V5.1 Phase 0 执行报告

执行日期为 2026 年 11 月 9 日，主机为 Windows x64。本报告记录实际执行结果，后续开发继续依据已批准的 V5.1 Phase 0–9 路线。

## 源码保护与 Git 基线

原始源码保存在 `C:\Users\yifan\Desktop\teacher_Agent`。开发使用独立目录 `C:\Users\yifan\Desktop\teacher_Agent_dev`，分支为 `teacher/v5.1-foundation`。

开发仓库的 origin 指向用户 Fork `https://github.com/yifan4243-sketch/teacher-agent.git`，upstream 指向 `https://github.com/NousResearch/hermes-agent.git`。URL 采用仓库地址，去除用户消息中链接末尾的中文句号。

本阶段以 Fork 的 `8c1a9c0b6da872cca5083b98a7a1022edc3dfb4b` 为基线。审计时 upstream/main 为 `34acabf0e681e9432059d1a060c78cc043becc0f`，领先 Fork 19 个提交。为保留可追溯的 Fork 基线，当前开发分支从 origin/main 创建。仓库采用 `blob:none` 部分克隆，保留完整提交历史，缺失文件对象按需获取。

保护快照位于 `E:\TeacherAgentBackups\phase0-20261109-205802-2272b9c0`。

| 项目 | 结果 |
| --- | --- |
| 原始文件 | 23,108 个，共 246,107,621 字节 |
| ZIP 快照 | `source-snapshot.zip`，105,123,129 字节 |
| ZIP SHA256 | `ee8f2632bea30fd54a667e4fa219bd8232d56d15731bdb8a300af604833a07be` |
| 归档核验 | 归档内逐文件 SHA256 核验通过 |
| 开发后复核 | 原目录 23,108 个文件哈希一致，修改或丢失 0 个 |
| 审计凭据 | 同目录 `manifest.json`、`comparison.json`、`archive.sha256` |

原始目录与 Fork 基线比较得到 22,844 个相同文件、263 个内容差异文件、1 个原目录独有文件和 377 个 Fork 独有文件。全部原始差异已纳入快照。

原目录独有的 `plugin-catalog/hermes-subscription-meter.yaml` 对应上游提交 `23daf39d35` 的删除。`run_agent.py` 差异包括 Fork 已有的 `f483ce2667` 委派模型配置修复。开发采用 Fork 现有版本。此前规划中的 `just` 差异方向已更正，Fork 锁文件包含 `just`，原始目录缺少该项。

## 开发环境

使用官方入口 `setup-hermes.ps1 -RuntimeOnly -TestExtras all`，执行成功。Python 运行环境和测试环境均由 Hermes PM 管理。

| 项目 | 实际版本或位置 |
| --- | --- |
| Python | 3.14.9，AMD64 |
| Node | v26.12.1 |
| pnpm | 12.15.0，与项目锁定版本一致 |
| OpenAI SDK | 2.54.0 |
| FastAPI | 0.133.1 |
| HERMES_HOME | `E:\TeacherAgentData\dev-home` |
| HERMES_RUNTIME_DIR | `E:\TeacherAgentData\runtime` |
| Bootstrap Python | `E:\TeacherAgentData\bootstrap-python` |
| 测试 shell | `D:\Tools\Scoop\apps\git\current\bin\bash.exe` |

激活时使用管理的 Python 执行 `-m pm.environments`，将返回的环境映射应用于当前 PowerShell。开发状态与用户默认 Hermes 状态分开保存。Node 工作区使用根目录 `pnpm install --frozen-lockfile`，成功安装 1,123 个包，锁文件供应链检查通过。

## 原版运行验证

`hermes --version` 和 `hermes chat --help` 均执行成功，Python 源码导入位置指向开发目录。

### Standalone serve

真实启动 `hermes serve --host 127.0.0.1 --port 19119 --isolated`。`/api/health` 返回 `ok=true`，版本为 `git.8c1a9c0`。WebSocket 连接及 `session.list` 成功。

该入口返回旧版协议，`runtime.describe` 返回方法不可用。因此，后续原生会话接口通过 canonical Gateway 单独验证。

### Canonical Gateway

通过官方 `hermes gateway ensure --json --timeout 60` 启动，再通过 `gateway attach --json --start` 获取一次性连接票据。票据仅在探针内存中使用。

真实连接协商协议为 `hermes-gateway-v1`。`runtime.describe` 返回 `plugin-rpc-v1`、`session-client-v1`、`session-transcript-v1` 等能力。CLI 会话创建、相同 request_id 的幂等重试、创建会话出现在列表中以及 GUI 策略会话创建均通过。

隔离配置当时尚未选择默认模型。首次省略模型的会话创建返回 `storage_unavailable`，日志指向空模型的 policy 校验。随后在探针会话中显式指定 `provider=openai` 和 `model=gpt-4.1`，验证会话存储与协议。该选择仅用于本地协议检查，该协议探针提交给模型的请求数为 0。

### 原生 Desktop

根工作区依赖安装完成后，执行 `pnpm --filter hermes run build` 成功。Renderer 编译 16,277 个模块，Electron main、preload 及 Windows 原生依赖均完成构建。构建输出包含已有的分块配置和动态导入警告，完整日志已保留。

使用项目锁定的 Electron 44.9.3 启动真实源码应用，界面数据保存于 `E:\TeacherAgentData\desktop-user-data`，连接隔离的开发 Gateway。原版自动检测到 Gateway 的旧源码 SHA，并成功重启至修复提交。应用从 CONNECTING 过渡页进入中文姓名设置表单，截图保存在 `phase0-evidence/desktop-startup.png`。

第一次截图过早捕获了连接过渡页，随后增加就绪等待并重新启动，第二次截图记录实际引导界面。引导进行中观察到两份相同姓名表单，这项界面表现需要在后续 Desktop 工作中复核。

原版首次启动会自动申请 Nous 免费欢迎试用，并启动引导。两次启动共自动提交两次引导消息，日志确认 1 次 `nous/welcome` API 请求成功返回，另一次停留于 `setup_beat` 姓名表单等待。源码 `hermes_cli/welcome_trial.py` 将该服务定义为免费推理，并记录 OS 用户级试用标记。此前“未调用模型”的描述只适用于独立协议探针，Desktop 实际行为以本段为准。

探针关闭 Desktop 后，使用官方 `hermes gateway stop --yes` 结束本阶段开发 Gateway 和仍在等待的引导任务，再按 PID 与启动时间核对停止自建 standalone serve。会话记录及日志保留于开发状态目录。

教师课程使用的正式模型鉴权、教材问答、业务工具调用与教学工作流推理质量仍需配置并验证。

## 基线问题与修复

修改前使用官方测试入口运行 13 个文件，结果为 664 通过、10 失败、12 跳过，耗时 198.7 秒。

| 问题 | 实际处理 |
| --- | --- |
| Windows Skill 相对路径返回反斜杠 | `skill_view` 的本地与外部 Skill 相对路径统一使用 `as_posix()`，保持绝对 `skill_dir` 的宿主路径格式 |
| 两个 Skill 测试对路径分隔符的约定冲突 | 统一检查使用正斜杠的相对路径 |
| Portable plugin fixture 将 Windows 路径写入 darwin 声明 | 声明使用真实宿主 `sys.platform` |
| Profile 的 POSIX 权限断言运行于 Windows | 保留跨平台创建和隔离断言，仅在 POSIX 上检查 0600 权限位 |
| 符号链接测试缺少本机能力标记 | 复用现有 `require_symlinks` 探测标记，覆盖 4 个测试参数实例 |
| POSIX shell wrapper 测试缺少平台标记 | 加入现有 `platforms("posix")` 标记 |
| Windows wrapper 文件扩展名断言错误 | 比较实际创建的 wrapper 路径，继续断言逻辑别名 |

本机符号链接创建缺少所需权限。真实 NTFS junction 克隆测试在本机执行通过。

首次修复回归暴露另一条使用 `os.path.join` 的 Skill 路径断言，修正后再次执行相同 13 文件测试集。

## 最终测试

官方入口为 `scripts/run_tests.sh -j 4`，执行文件如下。

```text
tests/tools/test_registry.py
tests/tools/test_skills_tool.py
tests/hermes_cli/test_plugins.py
tests/hermes_cli/test_plugin_api_compat.py
tests/hermes_cli/test_profiles.py
tests/hermes_cli/test_win_pty_bridge.py
tests/gateway/test_session_plugin_rpc.py
tests/hermes_state/test_named_profile_session_db.py
tests/hermes_state/test_state_db_write_durability.py
tests/agent/test_prompt_caching.py
tests/agent/test_context_compressor.py
tests/agent/test_turn_facade_lease.py
tests/agent/test_iteration_budget_race.py
```

最终结果为 **669 通过、0 失败、17 跳过**，耗时 79.6 秒。覆盖工具注册、Skill、Plugin、Profile、Windows PTY、插件会话 RPC、数据库持久性、提示缓存、上下文压缩及并发预算。17 项跳过包括非 Windows 平台和本机符号链接能力限制。

`python scripts/check` 和 `python scripts/check --staged` 的 15 项检查均通过，代码健康检查为 0 blocking、0 advisory。测试范围为上述基线文件集，全仓完整测试集尚未执行。

## 已入库教学资源

`resources/manifest.json` 登记 3 项资源，SHA256 复核全部通过。

- V5.1 完整需求原文。
- 用户提供的原始教案 DOCX 模板。
- 用户在聊天中提供的完整工业机器人授课逐字稿范例。

授课稿保留课堂语言、互动、板书提示和全部正文，作为后续 Skill 的风格参考。范例的 5、7、2、1 分钟标注保留为参考元数据，正式课程采用 40+10+40 分钟规则。教材页码、图号及学科内容仍需对应教材核验。

教案模板的 OOXML 审计确认 A4 纵向、一个 14 行主表及固定行高。后续长教案导出需要使用派生模板验证跨页和行高，原始模板按字节保存。

## 后续开发条件

Phase 1 继续使用原生 Plugin、Tool、Skill 和 Desktop 扩展边界。正式授课稿和教案采用 DOCX 导出，教学活动合计 80 分钟，含休息的日历跨度为 90 分钟。

完整授课稿参考范例已就绪。教学身份模型应在正式批改和成绩写入前完成学生、课程和选课关联。图片转可编辑 PPTX 的技术验证按用户要求提前，验收需检查真实文字、形状等可编辑对象。

教师课程推理验证需要服务商、模型和有效鉴权。教案视觉验收需要可用的 Word 或兼容渲染链。图片重建验证需要真实课件样本。教师业务模块继续在后续阶段实现并分别测试。

## Git 交付

Windows 修复独立提交为 `ce7d855aef0843ca934071b34850caa1ed15a168`。教学资源、执行报告和测试凭据另行提交，交付分支为 `teacher/v5.1-foundation`。GitHub 同步采用普通 feature branch push。

## 本机复现入口

在开发目录的 PowerShell 中设置隔离目录并使用项目激活入口。

```powershell
$env:HERMES_HOME='E:\TeacherAgentData\dev-home'
$env:HERMES_RUNTIME_DIR='E:\TeacherAgentData\runtime'
$env:UV_PYTHON_INSTALL_DIR='E:\TeacherAgentData\bootstrap-python'
$env:PYTHONUTF8='1'
. .\activate.ps1
python .\hermes --version
python .\hermes gateway ensure --json --timeout 60
```

Desktop 源码启动可使用 `pnpm --filter hermes start`，并将 `HERMES_DESKTOP_USER_DATA_DIR` 设为上述独立目录、`HERMES_DESKTOP_HERMES_ROOT` 设为开发目录。运行状态和引导进度保存在隔离目录内。

原始日志和运行凭据保存在 `E:\TeacherAgentData\phase0-evidence`。本目录的 `phase0-evidence` 保留最终测试日志及可分享的核验结果，文本导出副本使用 LF 换行。`summary.json` 分别记录原始文件和导出副本的哈希。
