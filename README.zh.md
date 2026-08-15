# dsh-trajectory-collapse

一个 DeepSeek Harness **Web 界面** 永久插件：可以折叠 Agent 的轨迹（中间的思考步骤、工具调用、steering、workflow 运行等），同时**始终保留 Agent 的最终输出**。

## 功能

- **折叠 Agent 轨迹** — 每个已完成的轮次都可以折叠，只显示用户提问 + Agent 的最终回答。每条已完成的助手消息上都带有一个 `折叠轨迹 / 展开轨迹` 控件。
- **始终保留最终输出** — 即使折叠后，用户消息与收尾的助手输出也始终可见；只有中间的轨迹被隐藏。
- **会话头部切换** — 会话头部有一个 `折叠全部轨迹 / 展开全部轨迹 / 恢复默认` 按钮，可一键折叠或展开所有已完成的轮次。
- **设置** — 在 设置 → 通用 中有一个勾选项 **最终输出完毕后默认折叠 Agent 轨迹**（在最终输出完成后默认折叠轨迹）。该项**默认勾选**。取消勾选后，轨迹默认保持展开，直到你手动折叠。

## 工作原理

该插件是安装到 `web` profile 的永久 bundle：

- `cordis.patch.yml` — 插入 loader 行。
- `lib/index.js` — Host 半边（空操作；功能都在浏览器端）。
- `lib/client.js` — 浏览器半边。它观察聊天流（`[data-chat-flow]`），把流节点按轮次分组，并用 `data-dsh-traj` 属性标记轨迹节点。注入的 CSS 会隐藏被标记的节点。它还注册了设置行、会话头部切换按钮和逐轮次控件。

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
