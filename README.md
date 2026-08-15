# dsh-trajectory-collapse

A permanent DeepSeek Harness **web GUI** plugin that lets you collapse the agent's
trajectory (the intermediate work: tool calls, thinking steps, steering,
workflow runs) while **always keeping the agent's final output visible**.

## Features

- **折叠 Agent 轨迹 / Collapse the agent trajectory** — collapse is **per-turn**:
  each completed agent output gets a small, restrained toggle at its **top**
  (`展开轨迹 / 折叠轨迹`) so you control each turn individually. The toggle
  sits above the trajectory and below the user message; it only appears on
  turns that actually have a trajectory to collapse.
- **始终保留最终输出 / Final output is always kept** — even when collapsed, the
  user message and the closing assistant output stay on screen; only the
  intermediate trajectory is hidden.
- **Collapsible trajectory kinds** — tool calls (`tool-call`), thinking steps
  (non-final `assistant-step`), steering, workflow runs, context-injection rows
  (`context`, e.g. system prompt / skill catalog), and unknown rows.
- **Settings** — in Settings → General there is a checkbox
  **最终输出完毕后默认折叠 Agent 轨迹** (default-collapse after the final output
  completes). It is **checked by default**. Unchecking it keeps trajectories
  expanded until you expand/collapse them per turn.

## How it works

The plugin is a permanent bundle installed into the `web` profile:

- `cordis.patch.yml` — inserts the loader row.
- `lib/index.js` — the Host half (no-op; the feature is browser-side).
- `lib/client.js` — the browser half. It observes the chat flow
  (`[data-chat-flow]`), groups flow items into turns, and marks trajectory
  nodes with a `data-dsh-traj` attribute. Injected CSS hides marked nodes.
  It also registers the settings row and injects the per-turn top toggle.

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
