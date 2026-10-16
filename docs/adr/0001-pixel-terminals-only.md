# 0001. Draw only in terminals that show pixels

- Status: Accepted
- Date: 2026-10-16

## Context

Claude Code's `Image` element draws through the kitty graphics protocol with Unicode placeholders. Where a terminal cannot, the element draws its `alt` text, and Claude Code decides per session which of the two happens.

## Options

1. `Image` only, with a notice where pictures cannot be drawn.
2. `Image` plus an approximate fallback (half-block cells, two pixels per cell), as jarrodwatts/claude-image-view does.

## Decision

Option 1. A half-block picture is a different product: its own decoder and layout to maintain, for a picture too coarse to read a screenshot from. Where pictures cannot be drawn, the person is told once why, and what fixes it, since most refusals have a fix.

## Evidence

- Ghostty, foreground session, Claude Code 2.1.301: `Image` drew PNG and animated GIF in a pane, the band above the prompt and a `ToolGroup` row.
- A background session in the same Ghostty: every `$.ui.blit` was refused with `the Image draws its alt here: the terminal draws no placeholder images (bg worker)`.
- The Claude Code binary reads `CLAUDE_CODE_FORCE_TERMINAL_IMAGES`. With it set to `1` in the `env` of `~/.claude/settings.json`, the running background session drew PNG and animated GIF without a restart.
- Other refusals found in the binary: `inside tmux or screen`, `VTE before 0.53 (shows the query as text)`, `no answer`, `this terminal cannot read files on this machine`.

## Consequences

- People in tmux, VS Code's terminal, Terminal.app or iTerm2 see a notice, not a picture.
- The notices follow Claude Code's refusal reasons and must track them.
