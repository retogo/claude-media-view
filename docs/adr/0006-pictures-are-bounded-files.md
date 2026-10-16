# 0006. Pictures for drawing are bounded files on disk

- Status: Accepted
- Date: 2026-10-16

## Context

An animated `Image` is swapped frame by frame with `$.ui.blit`. A source is either base64 bytes or a file the terminal reads itself. `$.fs.write` writes text only. No picture is drawn wider than 40 columns, yet a source can be a 1280×720 screen recording of hundreds of frames.

## Options

1. Blit base64 pixels for every frame.
2. Decode each source once, write its frames to a frame cache, and name a file in every draw and blit.
3. As option 2, at the source's full size, as raw RGBA.
4. As option 2, scaled and sampled to what a 40-column picture can show, as compressed PNG, with few writes at once.

## Decision

Option 4. Pixels cross `$` once, when a frame is written; every draw and blit after that carries only a path. What is decoded for drawing is bounded by what the picture can show, not by the source. Binary files are written by a process reading base64, since `$.fs.write` cannot.

## Evidence

- Probe with option 1: a 128×104 GIF is 53 KB of RGBA per frame (71 KB of base64). Four animated sites at about 10 fps made the session noticeably slow. With files, each blit carries about 100 bytes and the slowness went away.
- Option 3 worked through for a 1280×720, 400-frame recording: about 1.5 GB of frames held at once, 400 processes started together, up to 1.5 GB written to the tmp directory.
- jpeg-js's memory cap refused ordinary 4:4:4 JPEGs near 2048 px.

## Consequences

- The terminal decodes a PNG per blit instead of reading raw pixels.
- A frame left out by sampling lengthens the kept one before it, so an animation lasts as long as its source.
- The frame cache has no size bound yet.
- The Windows writer is not yet checked on a Windows host.
