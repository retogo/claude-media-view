# 0009. No enlargement on hover

- Status: Rejected
- Date: 2026-10-16

## Context

Pictures in the transcript are small (at most 40×20 cells). People want a bigger view without leaving the transcript. `Image` takes no `onPress`, and Claude Code has no modal. `Box` has `hover` (style overrides while the pointer is over it) and `position: "absolute"` (painted over what was drawn before it, clipped by its site).

## Options

1. Hover: a larger `Image` in an absolute `Box`, hidden until hovered.
2. A button under each picture that opens a wide pane.
3. The gallery's Open button only, which opens the OS viewer.

## Decision

No enlargement for now. Option 1 cannot keep transcript text off the picture, and option 2 is not worth its cost yet. Option 3 stays the way to see a picture at full size.

## Evidence

Probe mod, Claude Code 2.1.301, Ghostty, `"tui": "fullscreen"`:

- The hover tree validated: a 20×10 thumbnail and a hidden 90×45 enlargement in one `ToolGroup` row.
- Placed to the right of the thumbnail, the enlargement ran past the bottom of the viewport, and the reply drawn after the row showed its text over it.
- Placed above the thumbnail with its height capped at 60% of the viewport, transcript text above still showed through row by row. A picture shows only in cells that hold its placeholder characters, and text in a cell wins over it.
- Not tried: a hover scope that reveals the enlargement in another site (the band above the prompt, a pane), where no transcript text shares the cells.

## Consequences

- Revisit with a hover scope into another site, or if `Image` gains a press.
