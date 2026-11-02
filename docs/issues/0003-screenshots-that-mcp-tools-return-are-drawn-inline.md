---
type: Issue
title: Screenshots that MCP tools return are drawn inline
description: Image content that MCP tools return, such as browser screenshots, is drawn inline after the tool row.
status: open
blocked_by: [0001, 0002]
timestamp: 2026-11-02T14:29:08Z
---

## 0003. Screenshots that MCP tools return are drawn inline

## What / Why

Browser and QA tools reached over MCP return screenshots as image content. These are the images the owner most wants to see, and today the transcript shows only that one came back. Traces to the [constitution](/constitution.md), phase 2.

### Scope

- A finished MCP tool call whose result carries image content is drawn inline after the engine's row, one picture per image block, each fitted as in [issue 0001](/issues/0001-the-walking-skeleton-draws-a-png-that-read-returns-inline-in-the-terminal-with-the-plugin-gates-green-in-ci.md), converted as in [issue 0002](/issues/0002-jpeg-gif-and-webp-images-that-read-returns-are-drawn-too.md) when it is not PNG.
- First step: find, in the installed build's declarations and one real run, the shape of an MCP image result in the `ToolUse` render props ([research 0001](/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md) left it open).
- A call that reaches the MCP tool through another tool, such as the codemode plugin, whose output is text naming the saved picture, is drawn from that saved file.

### Decision

- The shape, found on 2026-11-02 (Claude Code 2.1.314) by a probe MCP server returning one PNG, and a probe mod writing what its `ui.render` hook on `ToolUse` received. A direct `mcp__<server>__<tool>` call gets `output` as a bare array of blocks in the Anthropic API form, not the declared `McpToolResult`: `[{ type: "text", text }, { type: "image", source: { type: "base64", media_type: "image/png", data } }, { type: "text", text: "[Image: source: <CLAUDE_CONFIG_DIR>/projects/<project>/<session>/tool-results/<server>-blob-<n>.png]" }]`, the whole base64 in `data`. The same tool called through the codemode plugin is the `mcp__codemode__codemode` row, whose `output` is a string, `"shot\n[Image: source: <path>]"`: no image block, only the saved file.
- Draw both, chosen by the owner: an image block's bytes, and a `[Image: source: <path>]` line whose path lies in Claude Code's own `tool-results` folders, `${CLAUDE_CONFIG_DIR ?? $HOME/.claude}/projects/<project>/<session>/tool-results/`. The engine wrote that file, so the plugin reads it as it reads a Read's file. Not taken: image blocks only, which leaves every codemode-routed screenshot undrawn. Cost: the `[Image: source: …]` text is the engine's, undocumented, and may change; a change leaves those rows as Claude Code draws them.
- A path outside that folder, relative, or holding a `..` segment is never read.
- A PNG over the 2 MiB `{ png }` limit, such as a full-page screenshot, is shrunk from its file through the converters of [issue 0002](/issues/0002-jpeg-gif-and-webp-images-that-read-returns-are-drawn-too.md) instead of being left undrawn: the saved file of an MCP image, and the `file_path` of a Read (owner's choice, 2026-11-02).

### Acceptance

- Tests over the found shape: one and several image blocks, a text-only result left as it is.
- The gates of issue 0001 pass.
- Demo: a screenshot from a browser MCP tool, such as Playwright, is drawn inline inside herdr.
