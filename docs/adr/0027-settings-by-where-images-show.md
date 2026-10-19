# 0027. Settings are split by where an image shows

- Status: Accepted
- Date: 2026-10-19

## Context

The first settings (ADR 0023) were cut along three axes at once: where an image shows (above the prompt, in sent prompts), which tool brought it (Read, any other tool) and how it was found (a path named in a reply). The person could not tell from the screen which setting governed a picture, and the same file read by Read and named in a reply showed under two settings.

## Options

1. Keep the five kinds, renamed.
2. One setting per place an image shows: above the prompt, under sent prompts, under Claude's tool calls, under Claude's replies; GIF animation apart, as it is about how pictures play, not where.
3. One setting per source of the bytes: a file media-view reads, or bytes a result carries.

## Decision

Option 2. A place is what the person sees, so each picture on screen answers to the setting named after where it is. Read and other tools both draw under a tool call's row and now share one setting; turning off a browser's screenshots alone, and keeping Read's images, is no longer possible.

The settings pane lists the places under one heading and GIF animation under another.

## Consequences

- The stored keys changed with the split: values kept under the earlier keys are not read, so every setting but the one above the prompt starts on again.
