---
type: Issue
title: The plugin is published as the public repository ejklock/claude-image-render with media of it working and release 0.1.0
description: Public repository ejklock/claude-image-render with SEO, media recorded in Ghostty, topics and release v0.1.0.
status: in-progress
blocked_by: [0001, 0002, 0003]
timestamp: 2026-11-02T14:29:09Z
---

## 0004. The plugin is published as the public repository ejklock/claude-image-render with media of it working and release 0.1.0

## What / Why

The owner asked to publish the plugin on GitHub under `ejklock`, public, with full SEO, screenshots or GIFs of it working, and topics. That is the same distribution as the owner's other mods (constitution).

### Scope

- The public repository `ejklock/claude-image-render`: description, topics, and a social preview.
- A README that sells and documents: what it does, a screenshot and a GIF recorded in Ghostty inside herdr, install through the plugin marketplace, supported terminals (kitty graphics: Ghostty, kitty, WezTerm; herdr), what it never does (rewrites nothing the model sees, no network).
- `CHANGELOG.md`, a release workflow, the `v0.1.0` tag and its GitHub release.
- Each outward step (creating the repository, push, release) runs with the owner's word.
- Renaming the local folder from `claude-image-mod` to `claude-image-render` is the owner's step, after the sessions that run in it close.

### Decision

- The README's media are recorded in Ghostty without herdr (owner, 2026-11-02): inside herdr every picture shows a thin horizontal line per cell row, and plain Ghostty draws it clean. Drawing inside herdr was shown in the demos of issues 0002 and 0003, and the README tells how to run it there. Not taken: recording inside herdr, which puts those lines in the README.
- The media are `docs/media/demo.gif` (3.7 MB, chosen by the owner over a 2.9 MB one with visible color banding), `docs/media/playwright-screenshot.png` and `docs/media/read-jpeg.png`. They were recorded by capturing the Ghostty window by its id while a scripted session typed the prompts; the pictures shown are a page made for the demo and a generated dashboard mockup, so no third-party image ships.
- The new README, `CHANGELOG.md` and the release workflow land in PR #1 before its merge; the `v0.1.0` tag is then pushed on `main`.

### Acceptance

- `gh repo view ejklock/claude-image-render` shows it public, with its description and topics; the `v0.1.0` release exists.
- Installing from the marketplace in a clean Claude Code and reading a PNG inside herdr draws it.
- The README's media show the real plugin in Ghostty.
