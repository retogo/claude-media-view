# 0017. A picture drawn at a new size is a new Image

- Status: Accepted
- Date: 2026-10-16

## Context

A picture's cell box follows the width it is drawn in, and that width changes: opening or closing a pane narrows or widens the transcript. Claude Code sends an `Image`'s source to the terminal again only when the source changes, and a picture's source (its frame file) stays the same at every size.

## Options

1. Keep one `Image` key per picture and let the engine resize it.
2. Change the source (a `generation`) when the size changes, so the engine sends it again.
3. Key each `Image` by its picture and its cell box, so a new size is a new element, and stop the blit loops of keys no longer drawn.

## Decision

Option 3. A new element is what the engine sends in full, whatever it compares sources by. Option 2 would bend `generation`, which marks new content under the same file name, to mean a new size.

## Evidence

- Claude Code 2.1.301, Ghostty: after `/media-view` opened the gallery and the person closed it, three Read pictures in one `ToolGroup` row showed in their wider boxes at the narrower size, the first two small with wide gaps between them. Scrolling the row out of view and back drew them at the right size.
- `Image`'s types: "A source equal to the last drawn sends nothing".
- A test mounts one row at 80 and at 30 columns: the second `Image` has another key, and after it only the new key is blitted.
- With the change, run through `claude --plugin-dir .`, opening and closing the gallery left the pictures at their new size.

## Consequences

- Each resize sends the picture to the terminal again.
