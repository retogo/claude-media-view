# 0010. Images reach the model as content blocks, one per GIF frame

- Status: Superseded by 0032
- Date: 2026-10-16

## Context

The model's `Read` of a GIF shows only its first frame. A tool registered with `$.tool.register` can answer with a result of its own shape. The API takes images up to 5 MB of base64 and 8000 px per edge, but once a request holds more than 20 images, every image is held to 2000 px; a larger one left in the history fails every later request.

## Options

1. Answer with MCP-style content.
2. Answer with Anthropic API content blocks (text and base64 images).
3. Write PNG files and answer with their paths, for the model to `Read`.
4. One contact sheet of all frames, or one image per frame.

## Decision

API content blocks, one image per sampled frame, each after a text block placing it in time. A still goes as it is when it is within the many-image limits, and is otherwise decoded, scaled to the edge the model reads at full detail, and shrunk until it fits. The format and size come from the file's content, never its name.

## Evidence

Probe tool, Claude Code 2.1.301:

- MCP-style content was refused before reaching the model: the result must be a string, an array, or undefined.
- Content blocks reached the model as images. One 524×320 sheet, ten 128×104 frames and ten 512×416 frames were each described correctly.
- Paths came back as text only and cost one more `Read` per file.
- A 2060×1256 sheet (about 14 MB of base64, uncompressed PNG) was dropped silently: only its text block arrived, with no error. Whether size or dimensions caused it was not isolated. Ten separate 512×416 frames arrived with fine detail legible.
- A JPEG named `.png` went out as `image/png` while the media type came from the extension.
- A 1600×800 PNG of random pixels and a 2880×1800 screenshot both fit once scaled and shrunk.

## Consequences

- The cost grows with the frames sent; the caller bounds it.
- Detail past the scaled edge is not sent.
- No sheet layout is built.
