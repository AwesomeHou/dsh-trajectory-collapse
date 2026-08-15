# dsh-trajectory-collapse

一个 DeepSeek Harness **Web 界面** 永久插件：可以折叠 Agent 的轨迹（中间的思考步骤、工具调用、steering、workflow 运行、上下文注入等），同时**始终保留 Agent 的最终输出**。

English: [README.en.md](README.en.md)

## 功能

- **逐轮次折叠 Agent 轨迹** — 折叠是**以轮次为单位**的：每个已完成的 Agent 输出顶部都有一个克制的 `展开轨迹 / 折叠轨迹` 小按钮，你可以单独控制每一次输出的轨迹折叠。该按钮位于轨迹上方、用户消息下方，且只出现在确实有轨迹可折叠的轮次。
- **始终保留最终输出** — 即使折叠后，用户消息与收尾的助手输出也始终可见；只有中间的轨迹被隐藏。
- **可折叠的轨迹类型** — 工具调用（`tool-call`）、思考步骤（非最终的 `assistant-step`）、steering、workflow 运行、上下文注入行（`context`，例如 system prompt / skill-catalog）以及 unknown 行。
- **设置** — 在 设置 → 通用 中有一个勾选项 **最终输出完毕后默认折叠 Agent 轨迹**（在最终输出完成后默认折叠轨迹）。该项**默认勾选**。取消勾选后，轨迹默认保持展开，直到你按轮次手动折叠。

## 工作原理

该插件是安装到 `web` profile 的永久 bundle：

- `cordis.patch.yml` — 插入 loader 行。
- `lib/index.js` — Host 半边（空操作；功能都在浏览器端）。
- `lib/client.js` — 浏览器半边。它观察聊天流（`[data-chat-flow]`），把流节点按轮次分组，并用 `data-dsh-traj` 属性标记轨迹节点。注入的 CSS 会隐藏被标记的节点。它还注册了设置行，并在每个已完成轮次的轨迹顶部注入逐轮次折叠按钮。

## 安装

在 DeepSeek Harness 检出目录（profile `web`）：

```
dsh plugin --profile web add <本仓库路径>
```

然后重启 harness。也可以从插件市场（`market_install` 传入本仓库）安装。

## 开发

```
pnpm run check   # 对两个半边分别执行 node --check
```

## 许可证

MIT
