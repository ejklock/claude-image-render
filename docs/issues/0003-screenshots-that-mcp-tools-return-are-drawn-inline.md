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

### Acceptance

- Tests over the found shape: one and several image blocks, a text-only result left as it is.
- The gates of issue 0001 pass.
- Demo: a screenshot from a browser MCP tool, such as Playwright, is drawn inline inside herdr.
