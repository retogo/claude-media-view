# 0008. GIFs move by default, and only where they are seen

- Status: Accepted
- Date: 2026-10-16

## Context

A GIF can be drawn as its first frame or animated. Animation costs a blit per frame, and a long transcript or a gallery can hold many GIFs.

## Options

1. A still first frame by default, with a command to animate.
2. Animate by default, with a command to stop; stop a loop when its row leaves the viewport.

## Decision

Option 2, as people expect GIFs to move. To keep it cheap:

- A transcript row animates only while it is on screen; the gallery only for entries inside its scroll window.
- Redraws go through state the drawing reads, so a toggle or a scroll redraws only what reads it, never every row.
- A stop holds even when it lands while a blit is in flight.
- Once the terminal refuses pictures, no new loop starts until the module reloads.
- Frame delays too short to honour play at the default delay, as browsers do.

## Evidence

- The probe first shipped option 1; the review asked for animation by default.
- With file frames (ADR 0006) and loops stopped when hidden, animated rows in Ghostty stayed light.
- A stop that only cancelled the timer let a tick waiting on `$.ui.blit` schedule the next frame, bringing the loop back, sometimes beside a second loop for the same `Image`.
- After a terminal refusal, every render started a loop that was refused again.

## Consequences

- After fixing the terminal (for example with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES`), GIFs move again only after `/reload-plugins` or a new session.
- `/media-view still` is the way out for a transcript with many visible GIFs.
