---
type: Research
title: Drawing the images Claude Code reads inline in Ghostty inside herdr
description: A Claude Code mod can draw a Read image with ui.Image; herdr forwards kitty images sent as direct bytes, placeholders included, but drops a file path, so the mod draws from a png source.
status: Draft
timestamp: 2026-11-02T13:51:24Z
---

# 0001. Drawing the images Claude Code reads inline in Ghostty inside herdr

## Question

Can a Claude Code mod draw, inline in the terminal transcript, the image that a `Read` of a PNG or JPG (or an MCP tool's screenshot) returns, on the owner's terminal path, Ghostty inside herdr? And how does the pi agent, which already does this, draw its images? The answer feeds the [constitution](/constitution.md) and the later ADR on the drawing mechanism.

## Method

On 2026-11-02, on the owner's machine (macOS, Claude Code 2.1.314, pi-coding-agent 1.4.0, Ghostty inside herdr):

- Read the mod API declarations the engine wrote for `claude-code-mermaid-render`: `.claude-plugin/types/claude-code/index.d.ts` and `.claude-plugin/types/claude-code-tools/index.d.ts`, written by Claude Code 2.1.300 [COI: Anthropic, the engine's own declarations]. The installed build is 2.1.314; the declarations were not regenerated for it.
- Read the mermaid-render mod's `hooks/register.tsx`, the reference mod that already draws a PNG with `ui.Image`.
- Read the pi package at `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent`: `docs/settings.md`, `docs/terminal-setup.md` and `node_modules/@earendil-works/pi-tui/dist/terminal-image.js`.
- Ran `strings` on `~/.local/bin/herdr` and `~/.local/bin/herdr-core`.
- Fetched the kitty graphics protocol page [1]; only its first 100000 of 117480 characters were read.
- The owner ran two probe scripts, kept outside the repository in `$TMPDIR`, in a herdr pane and in Ghostty outside herdr, and reported what each drew. Probe 1 (`kitty-probe.sh`) sends the PNG as a file path (`t=f`); probe 2 (`kitty-probe2.sh`) sends its bytes directly (`t=d`), chunked as pi does. Each probe draws once with direct placement (`a=T`) and once with Unicode placeholders (`U=1`).

Not done: drawing with the engine's own `ui.Image` inside herdr; the shape of an MCP tool's image result in the `ToolUse` render props.

## Findings

| # | Finding | Evidence | Confidence |
|---|---|---|---|
| F1 | The terminal surface is the only one with `Image`; it draws pixels "where the terminal can (kitty, Ghostty), the `alt` elsewhere", over `columns` by `rows` cells (1 to 255), with a required `alt` | `claude-code/index.d.ts:3895`, `:3916`, `:5425-5461` | high |
| F2 | An `ImageSource` is `{ png }` base64 (at most 2 MiB decoded), `{ rgba, width, height }`, `{ file, format: 'png' }`, `{ file, format: 'rgba' \| 'rgb', width, height }` or `{ shm, ... }`; a named file is read by the terminal, not the engine | `claude-code/index.d.ts:5464-5550` | high |
| F3 | The engine draws an `Image` with kitty Unicode placeholders: "no placeholder images" is one reason an Image draws its alt | `claude-code/index.d.ts:2404-2407` | medium [inference] |
| F4 | A `Read` of an image returns `{ type: "image", file: { base64, type, originalSize, dimensions } }`, with `type` one of `image/jpeg`, `image/png`, `image/gif`, `image/webp`, and `dimensions` carrying the original and the displayed (resized) size | `claude-code-tools/index.d.ts:4866-4885` | high |
| F5 | A `ui.render` hook sees the `ToolUse` component with `tool`, `input`, `output`, `isRunning` and `isErrored`, and can replace it with its own tree; mermaid-render does so and sizes a PNG to the card width capped by the viewport height | `claude-code-mermaid-render/hooks/register.tsx:57-60`, `:272-275`, `:289-296` | high |
| F6 | pi draws with the kitty or the iTerm2 protocol, detected automatically, at 60 cells wide by default; its docs warn that "a terminal proxy or multiplexer can make that detection inaccurate" and offer `PI_IMAGE_PROTOCOL` as the override | pi `docs/settings.md:106-111`, `docs/terminal-setup.md:209-214` | high |
| F7 | pi sends kitty images as direct data: `a=T,f=100,q=2`, base64 chunks of 4096 with `m=1`/`m=0`, no Unicode placeholders | pi-tui `dist/terminal-image.js:168-193` | high |
| F8 | In the kitty protocol, `t=d` (the default) carries the data in the escape code; `t=f`, `t=t` and `t=s` are local-client techniques; placeholders are `U+10EEEE` cells whose foreground colour encodes the image id and whose diacritics give row and column | [1] | high |
| F9 | herdr renders pane images itself: its default config carries `kitty_graphics = true`, "Render pane images in Kitty graphics-compatible outer terminals"; herdr-core embeds a terminal emulator with kitty graphics and virtual placeholder support | `strings ~/.local/bin/herdr`, `strings ~/.local/bin/herdr-core` | medium |
| F10 | Inside herdr, probe 1 (`t=f`) drew nothing in either mode; in Ghostty outside herdr it drew both | the owner's report of the run | high |
| F11 | Inside herdr, probe 2 (`t=d`) drew both direct placement and Unicode placeholders | the owner's report of the run | high |
| F12 | pi drew a PNG it had read, inline, inside a herdr pane | the owner's screenshot, 2026-11-02 | high |

## Contradictions

Probe 1 alone suggested that herdr blocks kitty graphics, while pi drew inside herdr (F12). Probe 2 settled it: herdr forwards images sent as direct data and drops images sent as a file path (F10, F11). Why herdr drops `t=f` was not looked into; a likely reason is that herdr's own emulator re-renders the image and does not read client files [inference].

## Analysis

The pieces a mod needs exist [inference from F1, F2, F4 and F5]: a `ui.render` hook on a finished `Read` whose output is an image can draw `<Image>` from the base64 the output already carries, sized like mermaid-render's card. Three gaps remain:

- **Format.** `ImageSource` takes PNG or raw pixels, and `Read` also returns JPEG, GIF and WebP (F2, F4). Those need converting to PNG, or decoding to RGBA, before drawing.
- **Size.** A `{ png }` source caps at 2 MiB decoded (F2). The `Read` base64 may already be resized (F4), which likely keeps most screenshots under the cap [inference].
- **Transmission in herdr.** A `{ file }` source probably makes the engine send `t=f` [inference, unverified], which herdr drops (F10). A `{ png }` source probably sends direct data, which herdr draws, placeholders included (F3, F11) [inference]. The one link still unproven is the engine's own `ui.Image` drawing inside herdr.

MCP screenshots were not looked into: their result shape in `ToolUse.output` is unknown.

## Recommendations

- Draw from a `{ png: base64 }` source, never `{ file }`, so the picture reaches Ghostty through herdr. Confidence: medium. It rests on F10 and F11 and on an unverified inference about which transmission the engine uses for each source.
- Make the walking skeleton the smallest mod that draws one PNG `Read` inside herdr. It closes the last unproven link before any ADR on the mechanism is recorded.
- In that skeleton's issue, also check the shape of an MCP image result and how to convert JPEG, GIF and WebP (for example `sips` on macOS, run through `$.process.run` [inference]).

# References

[1] KOVID GOYAL. **Terminal graphics protocol**. kitty documentation. Available at: https://sw.kovidgoyal.net/kitty/graphics-protocol/. Accessed on: 2026-11-02.
