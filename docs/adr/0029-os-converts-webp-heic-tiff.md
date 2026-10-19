# 0029. The OS converts WebP, HEIC and TIFF to PNG wherever a picture is loaded

- Status: Accepted
- Date: 2026-10-19

## Context

ADR 0002 left WebP, HEIC and TIFF to the OS's converters, unbuilt, so such files showed no picture: a WebP Read, an MCP tool answering with a WebP, a HEIC photo Claude names in a reply. The mod environment has no WebAssembly and no code generation, and nothing may need installing.

## Options

1. Convert where any picture is loaded, by its first bytes, so every place that draws one (tool calls, replies) gains the formats at once.
2. Convert only where a format is named (a Read's file type, a path's extension), place by place.
3. Have the converter also bound the size, as `sips -Z` does, to keep a large photo's PNG small.
4. Convert only files Read may read, leaving MCP tools' images, which a tool may have fetched from the web, unconverted.
5. Convert only once the person turns conversion on in the settings.
6. Convert unless the person turns conversion off in the settings.

## Decision

Option 1. The source is written beside the picture's frames, the OS converts its first frame to PNG (`sips` on macOS, the Windows Imaging Component through PowerShell), and that PNG is decoded as any PNG is, scaled by the module as other pictures are. Linux has no converter installed by default, so these formats stay undrawn there.

The OS's decoders allocate whatever a header declares, as the module's would without ADR 0012. So a source reaches the OS only when its header declares a size within the pixel cap PNG, GIF and JPEG are held to: a WebP's first chunk, a TIFF's first IFD, a HEIC's largest `ispe` box. A file whose size cannot be read is not converted.

A conversion that fails, or whose PNG cannot be read back (one past the size media-view reads), is no picture, not a failure to retry: the same bytes fail the same way, and a retry would convert again. Writing the source is I/O, retried as any write is (ADR 0007).

Option 3 is not taken: `sips -Z` enlarges a small image as readily as it shrinks a large one.

Option 6, over 4 and 5. Converting hands bytes that arrive unopened, an MCP tool's image from the web among them, to the OS's native decoders, which have had flaws exploited by such files (CVE-2023-4863 in libwebp, reached through ImageIO). An exploit runs as the person, as Claude Code does, and needs a flaw an up-to-date OS has not fixed. Leaving MCP images out narrows little, since files Read may read are often downloads; a setting off by default leaves the formats undrawn for most people. So conversion is on by default and the person's to turn off, one setting for every converted format: what sets these formats apart is the native decoder, not the format.

While conversion is off, a converted format shows no picture and is not remembered as having none: once it is turned on, the next draw converts it. Pictures already converted stay, as the decoder has already read them.

Replies name these formats by `.webp`, `.heic`, `.heif`, `.tif` and `.tiff`. Pastes and the `frames` tool stay with PNG, GIF and JPEG: a paste's completeness is judged from bytes the module decodes, and the frames tool hands the model formats the API takes.

## Evidence

macOS 26.6.2, a 640×360 PNG saved as WebP (Pillow), HEIC and TIFF (`sips -s format heic|tiff`), then `sips -s format png in.<ext> --out out.png`:

| Format | First bytes           | Time   | Output      |
| ------ | --------------------- | ------ | ----------- |
| WebP   | `RIFF` size `WEBPVP8` | 0.04 s | 640×360 PNG |
| HEIC   | size `ftypheic`       | 0.14 s | 640×360 PNG |
| TIFF   | `MM\0*`               | 0.02 s | 640×360 PNG |

- The same three files copied to `source`, with no extension, converted alike: `sips` reads the format from the content.
- `sips -s format png -Z 2000` on the 640×360 WebP wrote a 2000-pixel-wide PNG; `-Z 100` wrote 100.
- A file of text named `bad.webp`: `Error: Cannot extract image from file.`, exit 13, no output file.

## Consequences

- WebP, HEIC and TIFF show on macOS and Windows under tool calls and replies, as their first frame: an animated WebP is a still.
- A large HEIC photo becomes a large PNG, read and drawn as a large PNG Read returns would be.
- The Windows command has not been run on a Windows machine yet; WebP and HEIC there need Microsoft's codec extensions, which recent Windows installs by default.
