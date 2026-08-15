# dsh-trajectory-collapse

A permanent DeepSeek Harness **web GUI** plugin that lets you collapse the agent's
trajectory (the intermediate work: tool calls, thinking steps, steering,
workflow runs) while **always keeping the agent's final output visible**.

## Features

- **折叠 Agent 轨迹 / Collapse the agent trajectory** — each completed turn can be
  collapsed to show only the user prompt + the agent's final answer. A per-turn
  `折叠轨迹 / 展开轨迹` control sits on every finalized assistant message.
- **始终保留最终输出 / Final output is always kept** — even when collapsed, the
  user message and the closing assistant output stay on screen; only the
  intermediate trajectory is hidden.
- **Session header toggle** — a `折叠全部轨迹 / 展开全部轨迹 / 恢复默认` button in the
  session header collapses or expands every completed turn at once.
- **Settings** — in Settings → General there is a checkbox
  **最终输出完毕后默认折叠 Agent 轨迹** (default-collapse after the final output
  completes). It is **checked by default**. Unchecking it keeps trajectories
  expanded until you collapse them manually.

## How it works

The plugin is a permanent bundle installed into the `web` profile:

- `cordis.patch.yml` — inserts the loader row.
- `lib/index.js` — the Host half (no-op; the feature is browser-side).
- `lib/client.js` — the browser half. It observes the chat flow
  (`[data-chat-flow]`), groups flow items into turns, and marks trajectory
  nodes with a `data-dsh-traj` attribute. Injected CSS hides marked nodes.
  It also registers the settings row, the session-header toggle, and the
  per-turn control.

## Install

From a DeepSeek Harness checkout (profile `web`):

```
dsh plugin --profile web add <this-repo-path>
```

Then restart the harness. Or install from the marketplace (`market_install` with
this repo).

## Development

```
pnpm run check   # node --check on both halves
```

## License

MIT
