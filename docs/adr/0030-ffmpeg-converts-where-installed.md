# 0030. ffmpeg converts in place of the OS where the person installed it

- Status: Accepted
- Date: 2026-10-19

## Context

ADR 0029 has the OS convert WebP, HEIC and TIFF: none on Linux, and on Windows an animated WebP stays a still. ADR 0002 turned down ffmpeg as a requirement, as it would need installing and its licence binds whoever distributes it, and foresaw an optional ffmpeg the person installs and media-view only runs. Some people have one on their PATH.

## Options

1. The OS only.
2. ffmpeg only where the OS has no converter (Linux).
3. ffmpeg in place of the OS wherever it runs, unless the person turns that off in the settings.
4. ffmpeg where it runs, and the OS where ffmpeg fails.

## Decision

Option 3. Where `ffmpeg -version` runs from the session's PATH, ffmpeg converts every converted format: a still, or the first frame of anything else, to PNG, and an animated WebP to a GIF with a palette of its own. It does so on every OS alike, so Linux gains the formats and Windows plays animated WebPs. The setting is on by default, as every setting is, and changes nothing where ffmpeg is missing.

Whether ffmpeg runs is asked once per session; one installed later counts from the next session. ffmpeg is native code, as the OS's decoders are, so the setting that turns conversion off (ADR 0029) turns ffmpeg off too, and the same pixel caps apply before either runs.

Option 4 is not taken: a failed conversion is no picture whatever converted it, and the person who prefers ffmpeg can turn the preference off.

## Evidence

ffmpeg 9.0.1 from nixpkgs (`--enable-libwebp`), macOS 26.6.2:

| Input                             | Command                                                                                          | Time   | Output                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------ |
| WebP, 1280×720                    | `ffmpeg -nostdin -v error -y -i in -frames:v 1 -update 1 out.png`                                | 0.12 s | 1280×720 PNG                                     |
| HEIC, 1280×720 (`sips`)           | same                                                                                             | 0.26 s | 1280×720 PNG                                     |
| HEIC, 4032×2268 (`sips`)          | same                                                                                             | 1.77 s | 4032×2268 PNG                                    |
| TIFF, 1280×720 (`sips`)           | same                                                                                             | 0.37 s | 1280×720 PNG                                     |
| Animated WebP, 3 frames of 200 ms | `ffmpeg … -i in -filter_complex 'split[a][b];[a]palettegen[p];[b][p]paletteuse' -loop 0 out.gif` | 0.05 s | GIF of 3 frames of 200 ms, looping, colours kept |

- Each input copied to `source`, with no extension, converted alike.
- Text named `bad.webp`: `missing RIFF tag`, exit 69, no output file.

## Consequences

- With ffmpeg installed, WebP, HEIC and TIFF show on Linux, and animated WebPs play on every OS.
- An older ffmpeg may lack a decoder, or HEIC's tiled images; such a file then shows no picture until the preference is turned off.
