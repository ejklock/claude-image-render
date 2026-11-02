---
type: Issue
title: JPEG, GIF and WebP images that Read returns are drawn too
description: JPEG, GIF and WebP Read results are converted to PNG and drawn; the conversion approach is chosen with the owner.
status: open
blocked_by: [0001]
timestamp: 2026-11-02T14:29:07Z
---

## 0002. JPEG, GIF and WebP images that Read returns are drawn too

## What / Why

`Read` also returns JPEG, GIF and WebP, and `ui.Image` takes only PNG or raw pixels ([research 0001](/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md), F2 and F4). Screenshots and photos are often JPEG, so without this slice many of the images the agent reads stay invisible. Traces to the [constitution](/constitution.md), phase 2.

### Scope

- A JPEG, GIF or WebP that `Read` returns is turned into a PNG (or RGBA pixels) and drawn as the PNG of [issue 0001](/issues/0001-the-walking-skeleton-draws-a-png-that-read-returns-inline-in-the-terminal-with-the-plugin-gates-green-in-ci.md) is. A GIF shows its first frame.
- A conversion that fails or runs past a timeout leaves the row as Claude Code draws it.
- Nothing leaves the machine (constitution).

### Decision

How to convert is open and goes to the owner before the coder brief: for example `sips` on macOS run through `$.process.run`, or a decoder bundled into the plugin. It weighs platform reach, plugin size and the time to the first picture.

### Acceptance

- Tests: a JPEG, a GIF and a WebP Read each draw an `Image`; a conversion failure and a timeout each render what `next(e)` returns.
- The gates of issue 0001 pass.
- Demo: the owner asks the agent to Read a JPG photo inside herdr and sees it drawn.
