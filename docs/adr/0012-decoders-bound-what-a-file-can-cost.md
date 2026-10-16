# 0012. Decoders bound what a file can make them allocate and do

- Status: Accepted
- Date: 2026-10-16

## Context

Images come from the model's choice of path and from pastes, and files of many megabytes are read (ADR 0005). Each format declares sizes in its header that a decoder trusts at its peril: a GIF's screen and frames up to 65535×65535 and as many frames as the file holds, a PNG's size and bit depth with data that zlib can inflate about 1000 times over, a JPEG's size and components.

## Options

1. Trust the header and let a large file fail by running out of memory.
2. Refuse, before allocating, anything whose declared size passes a bound, and stop work that runs past what the header declared.

## Decision

Option 2, every bound checked before the allocation or work it guards:

- Pixels per image or frame are capped, the same for PNG, GIF and JPEG, so one cap reasons about memory.
- A GIF's decoding work is also capped in total, counted from its descriptors before any frame is decoded: each frame's own pixels, and every copy of the screen (a frame that restores the previous one, a frame kept). Frame sizes alone would let tiny frames on a large screen copy the screen once each. A frame count alone would still let full-size frames through, and skipping frames that are not kept breaks the canvas later frames draw on.
- A still taken from a GIF keeps its first frame alone.
- PNG data is inflated in slices into a buffer of the size the header declares and refused as soon as it runs past. Only the bit depths the specification allows for each colour type are decoded.
- JPEG decoding keeps jpeg-js's own pixel and memory caps, raised to the common cap.

## Evidence

- A PNG header claiming 20000×20000 decoded for 78 s in the test runtime before the cap; after it, it is refused at once.
- `unzlibSync` with a fixed output buffer keeps memory bounded but keeps inflating: 200 MB of zeros took 413 ms into a 1000-byte buffer, about two minutes for 64 MiB of input.
- Through the frames tool (`claude -p --plugin-dir .`): a 113-byte GIF declaring 20000×20000 is refused; a 3000×1 PNG whose 195 KB of data inflates to 200 MB is stopped; a 485-byte GIF with 31 empty 4000×4000 frames, and a 940-byte GIF with 40 one-pixel frames that restore the previous one on a 4000×4000 screen, are refused before any frame is decoded.
- With 255 bits per sample, an RGBA pixel would take 127.5 bytes, so an image inside the pixel cap needs gigabytes.

## Consequences

- Images past the caps show no picture and are refused to the model, with the reason.
