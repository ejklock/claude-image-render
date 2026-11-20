---
type: Issue
title: A Read folded into a tool group draws its picture under the group line
description: Claude Code 2.1.328 folds a Read into a ToolGroup line, so the plugin draws the group's pictures under that line.
status: open
timestamp: 2026-11-20T05:19:56Z
---

## 0005. A Read folded into a tool group draws its picture under the group line

## What / Why

On Claude Code 2.1.328 a `Read` of a PNG draws no picture. The transcript folds the call into a `ToolGroup`, the one count line `Read 1 file`, and `hooks/register.tsx` only draws under a `ToolUse` row, so it returns `next(e)` unchanged. The row is a `ToolUse` only when the group is expanded (`--verbose`, the ctrl+o transcript).

Evidence (2026-11-20, Linux, Ghostty inside herdr, plugin 0.1.0 at `e5189b0`):

- A TUI run in a pty without `--verbose` read `/tmp/cr-driver/probe.png` (`tool_dispatch_end tool=Read ... outcome=ok` in the debug log); the screen showed `Read 1 file` and held no kitty graphics sequence (`ESC _G`).
- The same run with `--verbose` drew it: `ESC _G a=T,U=1,q=2,f=100,c=60,r=5`, the 60x5 cells `fitImage` gives a 360x61 PNG.
- The module loads and is admitted (`hooks module image-render@image-render loaded ... events: ui.render`), and the engine reports `kittyGraphics=yes (env: CLAUDE_CODE_FORCE_TERMINAL_IMAGES)`.
- The 2.1.328 declarations (carved from the installed binary's `claude-code.d.ts`) describe `ToolGroup` as "a run of tool calls the transcript folds into one count line (`Read 3 files, ran 2 shell commands`): reads, searches, listings", with `calls: ToolGroupCall[]` carrying `tool`, `input`, `output`, `isRunning`, `isErrored`, `isInterrupted`, and `isExpanded`.
- `ToolGroup` was already declared in 2.1.314; that a lone `Read` was not folded then is an inference from the 0.1.0 demos.

### Scope

- A `ui.render` of a `ToolGroup` on the terminal that is not expanded renders `next(e)` and, under it, the pictures of each finished call (not running, not errored, not interrupted) the existing `ToolUse` path would draw: a `Read` image, converted or shrunk as today, and an MCP call's pictures. Order follows `calls`.
- An expanded group draws nothing of its own: its rows are `ToolUse` rows, which already draw, so a picture is never drawn twice.
- A group with no drawable call, a surface other than the terminal, or a terminal without `Image` renders exactly what `next(e)` returns.
- `ToolUse` behavior is unchanged. No prop of the group is rewritten (hard rule 1).

### Decision

- Draw under the folded group line, chosen by the owner on 2026-11-20. Not taken: setting `isExpanded` on groups that hold a picture so the `ToolUse` path draws (it unfolds every call of the group, Grep and Glob included, which nobody asked for); documenting `--verbose` or fullscreen ctrl+o only (no picture in the default view).

### Acceptance

- Tests (red first): a folded group holding a finished PNG `Read` renders `next(e)` with an `Image` under it; an expanded group, a running, errored or interrupted call, and a group without an image each render exactly `next(e)`; a group of two image calls draws both in order.
- `claude plugin test .`, `claude plugin validate .`, `se-gates check` and `living-docs check` pass.
  - 2026-11-20: 234 pass, 0 fail (222 before; 5 of the new tests red against `e5189b0`); validate, `se-gates check` and `living-docs check` exit 0.
- Demo: a TUI run without `--verbose` on Claude Code 2.1.328 reading `/tmp/cr-driver/probe.png` emits a kitty graphics sequence under `Read 1 file`, and the owner sees the picture inside herdr.
  - 2026-11-20, pty run with `--plugin-dir .`: the screen showed `Read 1 file` and emitted `ESC _G a=T,U=1,q=2,f=100,c=60,r=5`; the same run on 0.1.0 emitted none. The owner's view inside herdr is pending.
