# 0002. No ffmpeg: PNG, GIF and JPEG are decoded in the module

- Status: Accepted
- Date: 2026-10-16

## Context

`Image` takes PNG or raw RGB/RGBA. Pasted and read images also arrive as GIF and JPEG, sometimes WebP, HEIC or TIFF. media-view should run on macOS, Linux and Windows with nothing to install, and ffmpeg is LGPL/GPL.

## Options

1. ffmpeg for every format other than PNG, as iamumeransari/claude-show-your-work does.
2. OS converters only: `sips` on macOS, ImageMagick on Linux (not installed by default), Windows Imaging Component through PowerShell.
3. Decoders in the hooks module.
4. WebAssembly decoders.
5. For JPEG: vendor jpeg-js with the fewest changes that make it load, or rewrite a decoder.

## Decision

- GIF: a decoder written for this project, since GIF is small and needs per-frame control (sampling, scaling while decoding).
- JPEG: jpeg-js's decoder, vendored with only the changes the mod environment forces (ES module export, `Uint8Array` data). A rewrite would carry the same logic with new bugs. Upstream fixes are re-applied by hand.
- PNG: drawn as it is; decoded only where it must be scaled.
- WebP, HEIC, TIFF: to be converted by the OS where it can (`sips`, WIC), unsupported on Linux.
- Video: out of scope.

## Evidence

- The mod environment has no `WebAssembly` and no code generation (`eval` and `new Function` throw), per Claude Code 2.1.301's hooks module types. Option 4 is impossible.
- jpeg-js 0.4.4 (`npm pack`): the package licence is BSD-3-Clause (Eugene Ware, 2014), but `lib/decoder.js` begins with an Apache License 2.0 header (notmasteryet, 2011, from pdf.js). The vendored file keeps both. Both are compatible with MIT.
- A `diff` against upstream shows only the two changes named above.
- Speed in the test runtime: a 2000×1500 JPEG decoded to 12,000,000 bytes of RGBA in 141, 96 and 77 ms over three runs.
- Claude Code downscales JPEGs it caches from pastes: a 4032×3024 photo was cached as 2000×1500.

## Consequences

- WebP, HEIC and TIFF conversion is not built yet; such files show no picture.
- Video later means an optional ffmpeg the person installs and media-view only runs (the licence obligations fall on who distributes ffmpeg), or OS frameworks with no Linux equivalent.
