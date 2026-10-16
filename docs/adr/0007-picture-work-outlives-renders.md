# 0007. Picture work outlives the render that asked for it

- Status: Accepted
- Date: 2026-10-16

## Context

A picture is loaded, decoded and written when a row is first drawn. A hook's `$` calls end when its dispatch is aborted, for example when a newer draw of the same row supersedes it. `$.ui.invalidate` cannot name one row: it redraws all of them. A paste can be read while Claude Code is still writing it.

## Options

1. Cache whatever the first attempt settles with.
2. Retry a failed attempt on the next draw, a few times.
3. Run the work on ports made from the session's `$` at `session.start`, keep a decoded plan until it is written, and retry only what can succeed later.

## Decision

Option 3.

- Work runs on the session's `$`, so redrawing a row never cuts it short.
- A source is decoded once; a retry only writes.
- Only failures that can pass are retried: a load or a write that failed, and a paste whose file or ending is not there yet. A source that is no picture or cannot be decoded is absent for good.
- Retries wait a short delay, so a paste being written can land, and stop after a few attempts, since each one redraws every row.
- Write processes are limited across all pictures, not per picture.

## Evidence

- A foreground session (Claude Code 2.1.301): a pasted 1350×1350 PNG left its row without a picture, with `$.process.run(mkdir) aborted`; every later draw reused the cached rejection.
- With retries alone (option 2), each abort used up a retry, each retry redrew every row and aborted other rows' work in turn, and each retry decoded the image again.
- A paste missing its last six bytes is retried and drawn once whole.
- The test kit answers every `$` alike, so running on the session's `$` is not reproduced by tests. It rests on `session.start`'s `$` serving the draft watch's timer after the hook returned.

## Consequences

- A stuck process still ends at `$.process.run`'s own timeout.
- A paste that takes longer than about a second to appear is not drawn until the next session.
