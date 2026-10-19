# 0019. Pictures are scaled by the average of the area each pixel covers

- Status: Accepted
- Date: 2026-10-19

## Context

Pictures are scaled down for drawing (ADR 0006) and for the model (ADR 0010). Picking one source pixel for each target pixel is fast, but past a factor of two it drops most of the source. On a screenshot this breaks text into broken strokes. Pictures drawn 40 columns wide also take some 800 device pixels on a high-density screen, more than a GIF frame's drawing edge.

## Options

1. Nearest pixel.
2. The average of the source area each target pixel covers, by opacity, so transparent pixels add no dark edge.
3. A smoother filter (bilinear, Lanczos), at more cost and code for a picture that is only shrunk.

## Decision

Option 2 everywhere a picture is scaled down. A JPEG still, one frame, is kept up to a larger edge than a GIF's frames, whose count multiplies their memory. A PNG is drawn as it is and needs neither.

## Evidence

- A 1384×789 Claude in Chrome screenshot of example.com, scaled to 512×292 by nearest pixel, showed its body text broken and unreadable in the transcript and the gallery.
- Timings in `claude plugin test`'s runtime, after warming up: 1280×720 to 512 px in about 60 ms, 1384×789 in about 53 ms, 6000×4000 in about 150 ms. Before the inner loops used flat typed arrays and local sums, 1280×720 took about 280 ms.

## Consequences

- A GIF of many large frames decodes more slowly: 200 kept 1280×720 frames add about 12 s once, before its row shows the picture.
