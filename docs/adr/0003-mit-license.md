# 0003. MIT licence

- Status: Accepted
- Date: 2026-10-16

## Context

media-view is open source and should be easy to adopt, fork and ship in other plugin marketplaces. It vendors jpeg-js (BSD-3-Clause and Apache-2.0, ADR 0002) and fflate (MIT).

## Options

1. MIT.
2. Apache-2.0, with an explicit patent grant and a NOTICE convention.

## Decision

MIT, the licence of the nearest projects and the least to comply with. Every vendored file keeps its own upstream licence header.

## Evidence

- MIT is compatible with BSD-3-Clause and Apache-2.0 code shipped under its own headers.
- jarrodwatts/claude-image-view and iamumeransari/claude-show-your-work use MIT.

## Consequences

- No patent grant beyond what MIT implies.
