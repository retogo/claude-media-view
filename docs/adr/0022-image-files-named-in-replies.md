# 0022. Image files named in replies are drawn when Read may read them

- Status: Accepted
- Date: 2026-10-19

## Context

Claude often makes a picture without showing it: a script writes a chart, a browser tool saves a screenshot to disk, and the reply only names the file. The transcript then shows a path and no picture. Only the reply's text reaches a render hook, and it is drawn again on every scroll and redraw.

## Options

1. Draw every path the text names, as the transcript draws a Read.
2. Draw only absolute paths of formats this module decodes, after the same permission check the frames tool makes (ADR 0011).
3. Ask the model to Read each image it means to show.

## Decision

Option 2, with one difference from the frames tool: a path Read would ask about is left undrawn instead of put to the person. A reply is drawn many times and the person asked for nothing, so a dialog per draw would be wrong; a denied or asked-about path shows no picture. A path to no file (a path the reply only proposes, or one Claude got wrong) is left at once, without retries.

Absolute local paths only: a relative path depends on a working directory the reply does not state, and a network share or device path (two separators, `/` and `\` alike as Windows reads them: `//host`, `/\host`, `\\host`) is never taken, since reaching one can hand that host the person's credentials, whatever the reply's text came from. A path in backticks is taken whole, spaces included, as screenshots are often named.

## Evidence

- A Claude in Chrome screenshot saved with `save_to_disk` was named in the reply as `/var/folders/…/claude-chrome-screenshots-…/screenshot-….jpg` while no picture showed.
- `AssistantMessage` props carry `text` and no file references.
- A first scan with one regular expression over the whole text took 12.6 s on 200,000 characters of `-/`, every `/` a possible start rescanning the rest. Splitting the text into words and testing each word anchored at both ends reads it once. Trimming a word's trailing punctuation with a pattern anchored at the end took 27.5 s on a word of 200,000 full stops before a letter; a loop back from the end does it at once.

## Consequences

- A file outside what Read allows without asking (outside the working directory, under a default permission mode) shows no picture.
- A file rewritten under the same path keeps the picture first drawn of it for the session.
