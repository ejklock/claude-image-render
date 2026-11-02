---
type: Constitution
title: claude-image-render Constitution
description: Foundational scope and non-negotiables for claude-image-render, a Claude Code plugin (image-render) that draws the images the agent reads inline in the terminal transcript.
status: Draft
timestamp: 2026-11-02T13:52:06Z
---

# claude-image-render Constitution

## Product

claude-image-render (the plugin `image-render`) is a Claude Code mod that draws, inline in the terminal transcript, the images the agent reads, so the owner sees what the agent saw without opening the file. pi already does this. It serves the owner's Claude Code sessions in Ghostty, inside herdr.

## Scope Boundaries

**In scope:**

- Images that a `Read` of an image file returns: PNG, JPEG, GIF and WebP.
- Screenshots that MCP tools return as images, such as a browser or QA tool.
- Inline pictures in the terminal transcript, as wide as the tool card and shrunk to fit the terminal height.
- Distribution like the owner's other mods: a GitHub repository under `ejklock` with its own plugin marketplace.

**Explicitly out of scope:**

- The desktop app, VS Code and every surface other than the terminal.
- A text fallback (Unicode half-blocks, ASCII art) for a terminal that cannot draw images; there the transcript stays as Claude Code draws it.
- Images the owner pastes into the prompt.
- Image files a Bash command writes or names in its output.
- Changing what the model receives from a tool.

**Phase boundaries:**

- Phase 1: a walking skeleton that draws one PNG `Read` inline inside herdr, which proves the drawing path ([research 0001](/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md)).
- Phase 2: JPEG, GIF and WebP, then MCP screenshots.

## Non-negotiables

- The mod only draws: no hook of it rewrites a tool's output, its input or the prompt, so the model's context is byte-for-byte the same with the mod on or off.
- Where the terminal cannot draw a picture, the transcript is what Claude Code draws without the mod.
- No image leaves the machine: the mod calls no network service.
- On the terminal surface only: on every other surface the mod renders nothing of its own.
- Every artifact in the repository (code, docs, commits) is in English; the conversation follows the owner's language.
- Diagrams are Mermaid.

## Amendment Log

Amendments are appended here as `## Amendment N — YYYY-MM-DD: summary`; the sections above are not edited once ratified.
