---
type: Issue
title: JPEG, GIF and WebP images that Read returns are drawn too
description: JPEG, GIF and WebP Read results are converted to PNG with sips or magick through $.process.run and drawn.
status: in-progress
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

- Convert with a host tool through `$.process.run`, chosen by the owner: `/usr/bin/sips` (built into macOS) first, then ImageMagick's `magick` when it is on the `PATH`; with neither, the row renders as Claude Code draws it. The hooks environment has no WebAssembly and no code generation (`claude-code/index.d.ts`, the hooks-module globals), so a compiled decoder can only run as a process. Both read the three formats here (2026-11-02, Ghostty on macOS: `sips -s format png -Z 1024` 40-50 ms per file; `magick <file>[0]` keeps a GIF's first frame). Not taken: decoders bundled into the plugin (pure-JS JPEG and GIF exist, WebP has no known pure-JS decoder without WebAssembly, an inference), `sips` alone, PNG only.
- The converter reads the file at the Read's `file_path`, not the bytes the Read returned: `$.fs.write` writes text only, so the bytes cannot reach a file without a shell. The picture is the file as it stands when drawn.
- The PNG is at most 1024 pixels on its longer side, which keeps a detailed photo near 1.2 MB, under the 2 MiB `{ png }` limit (a noisy 2400x1800 JPEG: 1.18 MB at 1024, 1.64 MB at 1200).
- `sips -Z` enlarges a smaller picture (a 300x200 GIF with `-Z 1200` came out 1200x800) and `sips` exits 0 for a file it cannot read, printing "not a valid file - skipping" (2026-11-02, macOS). So the size is read first with `sips -g pixelWidth -g pixelHeight`, `-Z 1024` is passed only when the longer side is over 1024, and an answer without both sizes counts as a failed `sips`, falling back to `magick`, whose `1024x1024>` only shrinks.
- `magick` reads `*`, `?` and `[` in a file name as a glob or a frame, so a path holding any of them is converted by `sips` alone.
- `magick` gets the format as an explicit prefix from the Read's MIME type (`jpeg:`, `gif:`, `webp:`), so a file whose content is another format (SVG, MVG) is never decoded as that format.
- No cache: the engine calls `ui.render` once per input value (props, viewport width) and a repaint reuses the answer (`claude-code/index.d.ts`, `'ui.render'`), so a picture is converted once per Read and again only on a width change.
- Linux distributions that ship ImageMagick 6 have `convert`, not `magick`; not covered here.

### Acceptance

- Tests: a JPEG, a GIF and a WebP Read each draw an `Image`; a conversion failure and a timeout each render what `next(e)` returns.
- The gates of issue 0001 pass.
- Demo: the owner asks the agent to Read a JPG photo inside herdr and sees it drawn.
  - Shown on 2026-11-02 (Claude Code 2.1.314): a Read of an 83 KB JPEG in a herdr pane drew 13 rows of kitty placeholders under `Read image (81.1KB)` (`hc read`).
