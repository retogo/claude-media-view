# 0020. The gallery's times are kept when a call answers or a prompt is sent

- Status: Accepted
- Date: 2026-10-19

## Context

The gallery should say when each image showed in the chat. No row a render hook draws carries a time, nor does the stored transcript reach a hook; `$.clock.now()` is the only clock.

## Options

1. The time a row was first drawn.
2. The time the event that put the image in the chat happened: a tool call answering with images, a prompt with pasted images being sent.
3. Read the times from the session's transcript file on disk.

## Decision

Option 2, kept in the session's state by tool call id or image tag, the first time only. A row is drawn again on every scroll, resize and reload, so option 1 drifts; option 3 reads an undocumented file. State outlives a hot reload of the module, where its own variables do not.

Only a prompt from this session's composer is timed: another agent's, peer's or session's prompt numbers its own pastes. An image shown before the module loaded, or in a resumed session, has no time and shows none.

## Evidence

- `ToolGroup`, `ToolResult` and `UserMessage` props carry no time, and the hooks module types offer none for transcript rows.
- `tool.call`'s result from core holds the same content blocks the row's `output` later does (a probe recorded both for a Claude in Chrome screenshot).

## Consequences

- One more matcherless hook on `tool.call` and one on `prompt.submit` (ADR 0014): a Read call's path is kept from the same `tool.call` hook.
