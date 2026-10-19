# 0024. A draw a newer one superseded fails quietly

- Status: Accepted
- Date: 2026-10-19

## Context

Claude Code draws a row again and again: a reply as it streams and when its turn ends, a pane opened several times in one command. A newer draw of the same row aborts the older one's dispatch, and the older draw's `$` calls in flight then reject. A render hook that throws is reported on the transcript as `ui.render hook skipped`, though the engine has gone on without that draw.

## Options

1. Let the aborted draw throw, and the line show.
2. Catch every failure in a render hook and answer with nothing.
3. Catch a failure only when the hook's dispatch has aborted (`next.signal`), answer with nothing then, and throw anything else.

## Decision

Option 3. An aborted draw's tree is never used, so its failure means nothing; a failure of a draw still under way is a real fault and stays visible.

## Evidence

- `media-view: ui.render hook skipped: threw HooksError: HooksError` showed four times in one session: twice right after a reply finished, twice right after `/media-view` opened its panes following a reload.
- A temporary catch in every render hook logged the failure as `AssistantMessage: HooksError at err (evalmachine…)`, with an empty message: a `$` call rejected by the engine, not media-view's own error.
- The hooks module types: `next.signal` aborts when "a hook above settled first", and "the dispatch had already gone on without it".
