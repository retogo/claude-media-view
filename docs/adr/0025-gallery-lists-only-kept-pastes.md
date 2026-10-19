# 0025. The gallery lists only the pastes in the draft or a sent prompt

- Status: Accepted
- Date: 2026-10-19

## Context

The gallery found pasted images by listing the paste cache (ADR 0004). Claude Code writes a paste's file there as soon as it is pasted and keeps it when the `[Image #n]` tag is taken out of the draft, so an image the person attached and then removed still showed in the gallery.

## Options

1. List every file in the paste cache.
2. List a paste only while its tag is in the draft, or once a prompt from this session's composer carried it.
3. List a paste only once a `UserMessage` row carrying its tag was drawn.

## Decision

Option 2. The draft's tags are already watched for the composer preview, and a sent prompt's tags are already kept with their time (ADR 0020), so both are known without drawing anything. Option 3 depends on the transcript drawing the row, which it does only for rows on screen.

## Evidence

- In a session on Claude Code 2.1.301, an image pasted into the draft and then removed from it kept its file in the paste cache and its entry in the gallery.

## Consequences

- A paste sent before the module loaded, or in a resumed session, is not in the gallery unless its tag is in the draft. The gallery is this session's images already (ADR 0021).
