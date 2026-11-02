# image-render

A Claude Code mod that draws the images Claude Code reads inline in the terminal transcript, using the mods API's `ui.Image` on terminals that speak the kitty graphics protocol (Ghostty, kitty, WezTerm).

Status: walking skeleton. The plugin loads and its `ui.render` hook renders exactly what Claude Code draws; it draws no image yet.

Install: `/plugin install image-render --marketplace ejklock/claude-image-render`

Run it from a checkout with `claude --plugin-dir <this folder>`. Checks: `claude plugin validate .` and `claude plugin test .`. License: MIT.
