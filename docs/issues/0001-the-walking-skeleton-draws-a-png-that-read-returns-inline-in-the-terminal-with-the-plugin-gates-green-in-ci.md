---
type: Issue
title: The walking skeleton draws a PNG that Read returns inline in the terminal, with the plugin gates green in CI
description: "Walking skeleton: the image-render plugin draws a PNG Read inline with ui.Image from a png source, with validate, test and se-gates green in CI."
status: open
timestamp: 2026-11-02T14:29:05Z
---

## 0001. The walking skeleton draws a PNG that Read returns inline in the terminal, with the plugin gates green in CI

## What / Why

The first slice and the tracer bullet: a `Read` of a PNG shows the picture right under its tool row, in Ghostty inside herdr. It proves the drawing path end to end on the real engine, the one link [research 0001](/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md) left unproven, and lays down the plugin, its tests and its CI gate, which every later slice reuses. Traces to the [constitution](/constitution.md), phase 1.

### Scope

- The plugin `image-render` (repository `claude-image-render`), laid out like the owner's public `claude-code-mermaid-render`: `.claude-plugin/plugin.json` (version 0.1.0, MIT, author Klock Tecnologia) and `.claude-plugin/marketplace.json`, `hooks/` with the hooks module, `tests/` run by `claude plugin test .`, `package.json`, `tsconfig.json`, `se-gates.config.json`, `LICENSE` (MIT, Klock Tecnologia), a short `README.md`, and `.github/workflows/ci.yml` running the gates.
- A `ui.render` hook on a finished, not errored, not interrupted `ToolUse` of `Read` whose output is `{ type: "image" }` with `file.type` `image/png`, on the terminal surface where `ui` has `Image`: it keeps the engine's own row (`await next(e)`) and draws an `Image` after it.
- The picture is 60 columns wide, or the available width when the terminal is narrower, and shrinks to fit the terminal height, a cell counted as about twice as tall as wide, as mermaid-render's `fitImage` does. The aspect comes from the PNG's own IHDR header.
- Everything else renders as Claude Code draws it: another tool, another MIME type, a running or failed Read, another surface, or a PNG over 2 MiB decoded.

### Decision

- Draw from a `{ png: base64 }` source taken from the Read output, not `{ file }`: herdr forwards kitty images sent as direct data and drops a file path ([research 0001](/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md), F10 and F11). Not taken: `{ file: path }`, which would avoid holding the bytes.
- Keep the engine's Read row and add the picture after it, rather than replacing the row: the owner still sees what was read.
- Size the picture at a fixed 60 columns (narrower when the terminal leaves less room), as pi does by default (`terminal.imageWidthCells: 60`, pi-coding-agent `dist/core/settings-defaults.js:36`), chosen by the owner after the first demo drew a full-width picture too large for the transcript. Not taken: filling the card width, the first rule; a fixed height of 20 rows.
- Inside herdr the engine turns kitty graphics off by itself: herdr answers the graphics probe but identifies as `libghostty` in XTVERSION, so every `Image` draws only its alt. `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` in the environment turns it on (Claude Code 2.1.314, herdr 0.9.5; found by the claude-code-mermaid-render session from `claude --debug-file` logs: `kittyGraphics=no` without it, `kittyGraphics=yes` with it). The plugin cannot set it; the README tells the user to, and the demo runs with it. Not taken: detecting herdr in the plugin and drawing anyway, which the engine does not allow.

### Acceptance

- Tests: a PNG Read draws one `Image` whose source is the output's base64 and whose size follows the fit rule, with cases for a wide and a tall picture capped by the viewport; a JPEG Read, a running, failed or interrupted Read, a non-Read tool, another surface and an over-limit PNG each render exactly what `next(e)` returns.
- No hook of the plugin rewrites a tool's output or input: the module registers no `PostToolUse` and returns no `updatedToolOutput` (constitution).
- `claude plugin validate .`, `claude plugin test .` and `se-gates check` pass locally and in CI.
- The README says that inside herdr Claude Code needs `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` to draw images.
- Demo, run by the owner: in a herdr pane, `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1 claude-klock --plugin-dir <repo>`, ask the agent to Read a PNG; the picture is drawn under the Read row.
