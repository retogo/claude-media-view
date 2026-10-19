# Architecture decision records

An ADR keeps what the code cannot say: why it is this way, the options not taken, and what was measured to decide. What the code says (file and function names, constants, the steps of an algorithm) stays in the code, and the reason for a single value goes in a comment beside it. So an ADR stays true while the code changes around its decision.

One file per decision: `NNNN-short-title.md`, numbered in order. A record is never rewritten to change its decision; a later record supersedes it, and the old one's status says so. Changing a value or a name inside a decision needs no new record.

## Format

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Rejected | Superseded by NNNN
- Date: YYYY-MM-DD
- Supersedes: NNNN (only when it replaces an earlier record)

## Context

What forced a choice: the problem, and the constraints from outside the code (Claude Code, the API, terminals, licences).

## Options

Each option considered, with its trade-offs.

## Decision

The option chosen and why, in terms of behaviour, not of the code that carries it out.

## Evidence

Experiments, spikes and measurements, with commands, inputs and observed results. Dead ends and workarounds belong here.

## Consequences

What follows: what gets easier, what gets harder, what is not built yet, what to revisit.
```

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-pixel-terminals-only.md) | Draw only in terminals that show pixels | Accepted |
| [0002](0002-no-ffmpeg-in-process-decoders.md) | No ffmpeg: PNG, GIF and JPEG are decoded in the module | Accepted |
| [0003](0003-mit-license.md) | MIT licence | Accepted |
| [0004](0004-pastes-from-the-paste-cache.md) | Pasted images are read from Claude Code's paste cache | Accepted |
| [0005](0005-read-large-files-in-slices.md) | Files of 4 MiB and more are read in slices through a process | Accepted |
| [0006](0006-pictures-are-bounded-files.md) | Pictures for drawing are bounded files on disk | Accepted |
| [0007](0007-picture-work-outlives-renders.md) | Picture work outlives the render that asked for it | Accepted |
| [0008](0008-gifs-move-by-default-where-seen.md) | GIFs move by default, and only where they are seen | Accepted |
| [0009](0009-no-enlarge-on-hover.md) | No enlargement on hover | Rejected |
| [0010](0010-images-to-the-model.md) | Images reach the model as content blocks, one per GIF frame | Accepted |
| [0011](0011-frames-reads-only-what-read-may.md) | The frames tool reads only what Read may | Accepted |
| [0012](0012-decoders-bound-what-a-file-can-cost.md) | Decoders bound what a file can make them allocate and do | Accepted |
| [0013](0013-frame-cache-in-claude-codes-private-tmp.md) | The frame cache stays in Claude Code's private tmp directory | Accepted |
| [0014](0014-loader-rules.md) | The hooks module follows the loader's rules | Accepted |
| [0015](0015-layers-named-after-claude-code.md) | Layers, and usecases named after Claude Code's events | Accepted |
| [0016](0016-ci-scope.md) | CI validates and tests the module on three OSes | Accepted |
| [0017](0017-a-new-size-is-a-new-image.md) | A picture drawn at a new size is a new Image | Accepted |
| [0018](0018-images-in-mcp-tool-results.md) | Images in MCP tool results are drawn from the result itself | Accepted |
| [0019](0019-scale-by-area-average.md) | Pictures are scaled by the average of the area each pixel covers | Accepted |
| [0020](0020-gallery-times-from-calls-and-prompts.md) | The gallery's times are kept when a call answers or a prompt is sent | Accepted |
| [0021](0021-gallery-records-in-session-state.md) | The gallery's records live in the session's state | Accepted |
| [0022](0022-image-files-named-in-replies.md) | Image files named in replies are drawn when Read may read them | Accepted |
| [0023](0023-settings-kept-in-the-store.md) | What media-view draws is the person's to choose, and kept across sessions | Accepted |
| [0024](0024-superseded-draws-fail-quietly.md) | A draw a newer one superseded fails quietly | Accepted |
| [0025](0025-gallery-lists-only-kept-pastes.md) | The gallery lists only the pastes in the draft or a sent prompt | Accepted |
| [0026](0026-gallery-follows-the-chat.md) | The gallery shows what the chat shows, newest first | Accepted |
| [0027](0027-settings-by-where-images-show.md) | Settings are split by where an image shows | Accepted |
