# image-render

A Claude Code mod that draws the images Claude Code reads inline in the terminal transcript, using the mods API's `ui.Image` on terminals that speak the kitty graphics protocol (Ghostty, kitty, WezTerm).

Status: PNG images that `Read` returns are drawn inline, under Claude Code's own `Read` row, 60 columns wide (narrower on a narrow terminal), on kitty-graphics terminals. Other files and other tools render exactly what Claude Code draws.

Inside herdr, run Claude Code with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1`: herdr identifies as libghostty, and without the variable Claude Code draws only the alt text.

Install: `/plugin install image-render --marketplace ejklock/claude-image-render`

Run it from a checkout with `claude --plugin-dir <this folder>`. Checks: `claude plugin validate .` and `claude plugin test .`. License: MIT.
