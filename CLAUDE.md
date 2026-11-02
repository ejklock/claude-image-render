# claude-image-render

A Claude Code mod, the plugin `image-render`, that draws inline in the terminal transcript the images the agent reads: a `Read` of a PNG, JPEG, GIF or WebP, and screenshots MCP tools return. It draws with the mods API's `ui.Image` (kitty graphics: Ghostty, kitty, WezTerm, and herdr in front of them). Started on 2026-11-02. The local folder is still `claude-image-mod`; the public repository is `ejklock/claude-image-render`.

Start at the [Constitution](docs/constitution.md). The evidence behind the drawing path is [research 0001](docs/research/0001-drawing-the-images-claude-code-reads-inline-in-ghostty-inside-herdr.md); the work is in [docs/issues](docs/issues/index.md).

## Living Docs

```
enforcement: guided   # strict | guided | lite
onboarded: 2026-11-02
```

Write an ADR only when a decision is expensive to reverse; every other decision lives in the issue that carries the work. Load-bearing decisions are confirmed with the owner before an ADR is recorded. `living-docs check` must pass; numbering, frontmatter and index rows are CLI-owned (`living-docs new/set/supersede/index/fmt`).

| Artifact | Location |
|---|---|
| Constitution | `docs/constitution.md` |
| ADRs | `docs/adr/` |
| Issues | `docs/issues/` |
| Research | `docs/research/` |

## Commands

| What | Command |
|---|---|
| Plugin manifest and hooks module | `claude plugin validate .` |
| Tests | `claude plugin test .` |
| Quality gate | `se-gates check` |
| Docs gate | `living-docs check` |

## Hard rules

1. **The mod only draws.** No hook rewrites a tool's output or input or the prompt: no `PostToolUse`, no `updatedToolOutput`, no `updatedMCPToolOutput`.
2. **Draw from bytes, never a file name.** `ui.Image` gets a `{ png }` or `{ rgba }` source; herdr drops a `{ file }` picture (research 0001). Inside herdr the engine draws images only with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` in its environment (issue 0001, Decision).
3. **Where the terminal cannot draw, render exactly what `next(e)` returns.** No text fallback.
4. **No network.** No image or any of its data leaves the machine.
5. **The mods API is early access.** Read the type declarations the installed build writes under `.claude-plugin/types/` before using a call; never trust memory of the API.
6. **All artifacts in English.** Conversation follows the owner's language.
7. **Diagrams are Mermaid.**

## Reference mod

`../claude-code-mermaid-render` already draws a PNG with `ui.Image` from a `ui.render` hook on `ToolUse` (`hooks/register.tsx`), with tests run by `claude plugin test .`, CI and release workflows. Follow its layout and idiom.

## Commit authorship

Git `Author` is `Klock Tecnologia <neto.nemesis@gmail.com>`, as in the reference mod.
