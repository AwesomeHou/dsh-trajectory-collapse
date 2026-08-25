# dsh-trace-collapse

A permanent DeepSeek Harness **web GUI** plugin that lets you collapse the agent's
trace (the intermediate work: tool calls, thinking steps, steering,
workflow runs, context injection) while **always keeping the agent's final
output visible**.

中文说明: [README.md](README.md)

## Demo

![Before / After](docs/before-after.gif)

Before collapsing, the full agent trace (thinking, tool calls, context
injection) is visible; click the "Collapse trace" toggle at the top of the trace
and only the user prompt plus the agent's final output remain — expand it back
anytime.

| Before (trace expanded) | After (final output only) |
| --- | --- |
| ![Before](docs/before.png) | ![After](docs/after.png) |

## Features

- **Per-turn trace collapse** — collapsing works **per turn**: every
  completed agent output gets a small, restrained `Expand trace / Collapse trace`
  toggle at its **top** (below the user message, above the trace), so you
  control each turn individually. It only appears on turns that actually have a
  trace to collapse.
- **Final output is always kept** — even when collapsed, the user message and
  the closing assistant output stay on screen; only the intermediate
  trace is hidden.
- **Collapsible trace kinds** — tool calls (`tool-call`), thinking steps
  (non-final `assistant-step`), steering, workflow runs, context-injection rows
  (`context`, e.g. system prompt / skill catalog), and unknown rows.
- **Settings** — in Settings → General there is a checkbox
  **Collapse agent trace by default after final output** (default-collapse after the final output
  completes). It is **checked by default**. Unchecking it keeps traces
  expanded until you collapse them per turn.

![Settings: default-collapse after final output](docs/setting.png)

## How it works

The plugin is a permanent bundle installed into the `web` profile:

- `cordis.patch.yml` — inserts the loader row.
- `lib/index.js` — the Host half (no-op; the feature is browser-side).
- `lib/client.js` — the browser half. It observes the chat flow
  (`[data-chat-flow]`), groups flow items into turns, and marks trace
  nodes with a `data-dsh-trace` attribute. Injected CSS hides marked nodes.
  It also registers the settings row and injects the per-turn top toggle.

## Install

**Option 1** — from a DeepSeek Harness checkout (profile `web`):

```
dsh plugin --profile web add <this-repo-path>
```

Then restart the harness.

**Option 2** — just ask your agent to install it:

```
帮我安装这个插件：https://github.com/AwesomeHou/dsh-trace-collapse
```

**Option 3** — install the marketplace first: https://github.com/AwesomeHou/dsh-plugin-marketplace , then search and install it from the marketplace, which also tracks future updates.

## Development

```
pnpm run check   # node --check on both halves
```

## License

MIT
