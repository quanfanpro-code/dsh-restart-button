# dsh-restart-button

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）插件：在侧边栏"设置"齿轮旁放一个"重启"按钮，点一下即可重启 DSH 应用。

A [DeepSeek Harness](https://github.com/deepseek-ai) (DSH) plugin that adds a "Restart" button next to the settings gear in the sidebar — one click to restart the app.

## 功能 / Features

- 侧边栏底部"设置"齿轮旁显示"重启"按钮，图标与齿轮同族、随侧边栏宽窄自动切换形态
- 点击后应用自动退出并按原命令重新启动，页面自动刷新恢复
- 重启过程有遮罩提示；每次重启在本机桌面留下日志（Windows）
- 走 DSH 官方插件机制（bundle 层 + 客户端插槽），可在插件市场中启用/停用/卸载

## 版本适配 / Compatibility

- v0.2.3：修复 Windows 下点击重启后服务退出却没有重新启动的问题；增加真实 PowerShell 子进程存活测试。针对 DSH 0.2.0-rc.1 进行验证。
- v0.2.x：适配 DSH 0.1.5+（0.1.5 起 `connection.rpc.handle` 仅供核心内部使用，插件改为直接注入 `webServer` 注册路由，通信信封格式不变）
- v0.1.x：适配 DSH 0.1.2


## 安装 / Install

前置要求：Windows 10+、Node.js、pnpm、DeepSeek Harness（web profile）。

方式一：直接从 GitHub 安装（pnpm 原生支持 github 源）

```powershell
dsh plugin --profile web add github:quanfanpro-code/dsh-restart-button
```

方式二：克隆后从本地目录安装

```powershell
git clone https://github.com/quanfanpro-code/dsh-restart-button.git
dsh plugin --profile web add "<克隆目录的完整路径>"
```

安装后**重启一次 DSH**（第一次还没有按钮，请手动重启），按钮即出现在侧边栏底部。

## 使用 / Usage

点击侧边栏底部的"重启"按钮即可。页面会断开数秒并自动恢复——这正是应用在重启，属正常现象。

## 工作原理 / How it works

- **客户端**（浏览器内 cordis 插件）：向官方 `sidebar.footer.action` 插槽注册按钮组件；点击后通过 RPC 通道通知服务端，并轮询页面直到应用恢复后自动刷新。
- **服务端**（Node 内 cordis 插件）：收到重启请求后，通过 Windows 原生 `Start-Process -WindowStyle Hidden` 启动独立 PowerShell 脚本，确认启动器成功退出后应用才退出；脚本检测到应用进程消失后，按 `node <bin.js> web --no-open` 重新启动 DSH，并在桌面写入 `插件重启结果.txt` 日志。命令按 UTF-16LE 编码传递，支持中文、空格和单引号路径；启动失败时保留原服务并返回错误。
- node 与入口脚本路径在运行时从当前进程获取，不写死路径。

## 自检 / Tests

```powershell
node test/run.js
node test/重启存活测试.js
node test/重启页面测试.js
# 输出 all checks passed 即通过
```

## 已知限制 / Limitations

- 仅面向 Windows（重启脚本使用 PowerShell；其余逻辑无平台依赖，欢迎 PR 补充 macOS/Linux 启动方式）
- 重启会中断"正在生成中"的那条回复；会话历史实时持久化，不受影响

## License

[MIT](LICENSE)
