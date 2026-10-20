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

An SVG is drawn at the size its root element declares in pixels, else its `viewBox`'s, scaled down to a still's longest edge. A size it declares nowhere, or as relative lengths alone, leaves it undrawn. ffmpeg, even where preferred, leaves SVG to the OS, as builds commonly lack librsvg.

What an SVG may hold is checked on the module's own reading of it, not left to the renderer, whose behaviour is the OS's to change:

- No `<!DOCTYPE`, which is where entities that expand as the SVG is read are declared.
- Nothing a parser would read in another encoding than UTF-8. The module reads the text as UTF-8; a parser honouring a declared UTF-7 would read `+ADw-!DOCTYPE` as a document type the module never sees. So an XML declaration is taken only first in the file, in the specification's form and order, declaring UTF-8 if any encoding, and no other `<?xml` may follow, a style sheet's processing instruction included.
- No reference outside itself: an `href` or a CSS `url(` must name a part of the SVG (`#id`) or carry a PNG, JPEG or GIF inline as a `data:` URL; no `@import`, `<foreignObject>` or XInclude, whatever namespace prefix the element carries. A character reference in a link counts as outside, and so does an inline SVG, whose own references this reading would not see. Charts and diagrams Claude writes refer to nothing outside, so little is lost; a link (`<a href="https://…">`) leaves the SVG undrawn.
- No escape in an attribute or a style sheet. A parser decodes `&#117;rl(` to `url(` and CSS reads `\75 rl(` as `url(`, so the patterns above, read on the raw text, would miss them. Text content may hold both, as labels often do.

These checks read the raw text with patterns rather than parsing XML and CSS, which the module has no parser for; each pattern is anchored so that a crafted file is read in time linear in its length (ADR 0022).

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
- An SVG with `<style>@import url(http://127.0.0.1:8766/style.css)</style>`, a `fill: url(http://…/other.svg#r)`, `<use xlink:href="http://…/other.svg#r">`, `<use href="file:///…/other.svg#r">` (a red square) and a `<foreignObject>` holding an `<iframe src="http://…">`, drawn by `NSImage` into a bitmap: the HTTP server logged no request, and no red showed.
- Text that is no SVG: `AppKit read no SVG`, exit 1, no output.
- ffmpeg 9.0.1 from nixpkgs lists no SVG decoder (`--disable-librsvg`); no `rsvg-convert` was installed.
- `$.process.run` gives up on a process after 30 s by default and rejects.

## Consequences

- An SVG a reply names shows on macOS; on Linux and Windows it shows no picture.
- An SVG declaring no pixel size and no `viewBox` shows no picture, nor does one with a document type, a declared encoding other than UTF-8, or a reference outside itself.
