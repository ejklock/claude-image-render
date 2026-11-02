# Changelog

## 0.1.0

- Draw the PNG that a `Read` returns inline under its tool row, at most 60 columns wide (narrower on a narrow or short terminal), on kitty-graphics terminals.
- Draw a JPEG, GIF or WebP that a `Read` returns, converted to a PNG with `sips` on macOS or `magick`.
- Draw the PNG image blocks that an MCP tool returns, such as a browser screenshot, one picture per block.
- Draw the pictures that Claude Code saved in its own `tool-results` folders and named in `[Image: source: <path>]` lines, which covers screenshots routed through the codemode tool; a path such a line names outside those folders is never read.
- Shrink a PNG over 2 MiB to at most 1024 pixels on its longer side from its file, for MCP pictures and for a `Read`.
- Leave every other file, image block and tool as Claude Code draws it.
