# 0031. AppKit draws SVG on macOS, at the size it declares

- Status: Accepted
- Date: 2026-10-20

## Context

Claude often writes diagrams and charts as SVG and names the file in its reply. An SVG is XML describing shapes, not pixels: it must be drawn at a size someone chooses, it can refer to other files and URLs, and XML can declare entities that expand as it is read. The converters of ADRs 0029 and 0030 take pixel formats. Read hands an SVG back as text, so the picture comes from a path a reply names.

## Options

1. AppKit's `NSImage`, from JavaScript for Automation, drawn into a bitmap of a chosen size, on macOS.
2. `sips`, on macOS.
3. Quick Look's `qlmanage -t`, on macOS.
4. `rsvg-convert` or an ffmpeg built with librsvg, where installed, on any OS.
5. A browser engine (Edge, WebView2) on Windows.

## Decision

Option 1, on macOS only; Linux and Windows draw no SVG for now. `NSImage` reads an SVG by its content and draws it at any size into a bitmap, written as a PNG. `sips` needs the `.svg` extension and draws at the SVG's own size; `qlmanage` pads to a square and is slower. Options 4 and 5 are left: nothing on Linux or Windows draws SVG out of the box, and a browser engine is too heavy for a picture in a row.

An SVG is drawn at the size its root element declares in pixels, else its `viewBox`'s, scaled down to a still's longest edge. A size it declares nowhere, or as relative lengths alone, leaves it undrawn, as does any `<!DOCTYPE`, which is where entities are declared. ffmpeg, even where preferred, leaves SVG to the OS, as builds commonly lack librsvg.

A drawing's cost does not follow from its size: paths, filters and nested `<use>` can keep a small SVG drawing for long. Every conversion is given up on past a time limit and counts as failed.

SVG falls under the setting that turns conversion off (ADR 0029): AppKit is native code reading what Claude wrote.

## Evidence

macOS 26.6.2, an SVG of 200×100 with a gradient, a circle and text:

| Command                                                                  | Time   | Output                   |
| ------------------------------------------------------------------------ | ------ | ------------------------ |
| `sips -s format png test.svg --out sips.png`                             | —      | 200×100 PNG, drawn right |
| `sips` on the same file named `source`                                   | —      | exit 13, no output       |
| `NSImage initWithContentsOfFile` on `source`, `TIFFRepresentation`       | 0.37 s | 200×100 PNG, drawn right |
| `qlmanage -t -s 512 -o ql test.svg`                                      | 0.49 s | 512×512 PNG              |
| `NSImage` drawn into an 800×400 `NSBitmapImageRep`, a `viewBox` of 20×10 | 0.12 s | 800×400 PNG, edges sharp |

- Setting the drawing context by assigning `$.NSGraphicsContext.currentContext` drew nothing; `setCurrentContext(...)` drew.
- An SVG with `<image xlink:href>` to a local PNG and to `http://127.0.0.1:8765/…`: `NSImage` and `sips` each drew a placeholder for both, and the HTTP server logged no request. One referring to `file:///etc/hosts` drew a placeholder as well.
- Text that is no SVG: `AppKit read no SVG`, exit 1, no output.
- ffmpeg 9.0.1 from nixpkgs lists no SVG decoder (`--disable-librsvg`); no `rsvg-convert` was installed.
- `$.process.run` gives up on a process after 30 s by default and rejects.

## Consequences

- An SVG a reply names shows on macOS; on Linux and Windows it shows no picture.
- An SVG declaring no pixel size and no `viewBox` shows no picture.
