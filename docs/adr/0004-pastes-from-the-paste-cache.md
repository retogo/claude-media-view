# 0004. Pasted images are read from Claude Code's paste cache

- Status: Accepted
- Date: 2026-10-16

## Context

A pasted image shows as `[Image #n]` in the prompt and in the sent `UserMessage` row. media-view needs its bytes both while the prompt is being written and after it is sent.

## Options

1. `prompt.submit`'s `attachments`, read with `$.prompt.media({ id })`.
2. A path in the submitted text.
3. The paste cache Claude Code writes, found from the `[Image #n]` tag.

## Decision

Option 3, the only one that works for a mod installed the ordinary way. While the prompt is written, the draft is polled, since pasting raises no event; after sending, the tag in the `UserMessage` text names the file.

## Evidence

Probe mod, Claude Code 2.1.301, one pasted PNG:

- `prompt.submit` `text`: `"[Image #5]"`, with no path.
- `attachments`: `[{"type":"image","mediaType":"image/png","filename":"<pasted name>.png","id":"media_…"}]`, the file name only.
- `$.prompt.media({ id })` from that same hook: `denied: no prompt.submit in flight carries an attachment under that id`. The types say this read is for mods installed by managed settings.
- `/tmp/claude-<uid>/<project>/<session>/images/` held `1.png` … `11.png`, `2.gif`, `10.jpg` for the session's pastes.
- The `UserMessage` row's `text` holds `[Image #n]` and no image data.
- jarrodwatts/claude-image-view and rkueny/claude-code-image-preview read the same cache on a 200 ms poll.

## Consequences

- media-view depends on an undocumented cache layout. Its root follows `CLAUDE_CODE_TMPDIR`, and Windows uses `%TEMP%\claude`, which is not yet checked on a Windows host.
- The poll reads no file unless the draft's text changed.
- Another agent's, teammate's or session's message numbers its own pastes, so only this session's own prompts are read.
