# image-render

A Claude Code mod that draws the images Claude Code reads inline in the terminal transcript, using the mods API's `ui.Image` on terminals that speak the kitty graphics protocol (Ghostty, kitty, WezTerm).

Status: PNG, JPEG, GIF and WebP images that `Read` returns are drawn inline, under Claude Code's own `Read` row, 60 columns wide (narrower on a narrow terminal), on kitty-graphics terminals. PNG image blocks that an MCP tool call returns (such as a browser screenshot, under 2 MiB) are drawn the same way, one picture per block, under the tool's row; so are the pictures Claude Code saved under its own `tool-results` folders and named in `[Image: source: <path>]` lines, which covers screenshots that come through the codemode tool (a path outside those folders is never read). JPEG, GIF and WebP are converted to PNG with `sips` on macOS or, failing it, ImageMagick's `magick` when installed; when neither converts the file, the row renders as Claude Code draws it. Other files, other image blocks and other tools render exactly what Claude Code draws.

Inside herdr, run Claude Code with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1`: herdr identifies as libghostty, and without the variable Claude Code draws only the alt text.

Install: `/plugin install image-render --marketplace ejklock/claude-image-render`

Run it from a checkout with `claude --plugin-dir <this folder>`. Checks: `claude plugin validate .` and `claude plugin test .`. License: MIT.
