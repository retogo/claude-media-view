# 0018. Images in MCP tool results are drawn from the result itself

- Status: Accepted
- Date: 2026-10-19

## Context

Claude sees images through tools other than Read: a browser's screenshot (Claude in Chrome), computer use, any MCP server that answers with a picture. Those pictures reached the model but showed nothing in the transcript, where only Read's images were drawn.

## Options

1. Draw the base64 image blocks of any tool result made of API content blocks.
2. Find a file path in the result's text ("Screenshot saved to: …") and read the file.
3. Handle each known tool by name.

## Decision

Option 1. The picture is already in the result, so nothing is read from disk and no permission is asked (ADR 0011 guards reads of paths, not this). It works for every tool that answers in the API's own shape, without knowing the tool. Option 2 depends on one tool's wording and on the person having asked it to save, and option 3 would chase each tool's changes.

Such a picture is in the gallery too, as every image of the session is. It has no file of its own, so it is named by its tool, and its buttons copy and open the PNG media-view wrote of it to the frame cache.

## Evidence

Claude in Chrome's `screenshot` in this session stored its result, as the transcript's `toolUseResult` and the `tool_result` content alike, as `[{ type: 'text', … }, { type: 'text', … }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }]`, with or without `save_to_disk` (which adds two more text blocks). A probe's `ui.render` hook on `ToolGroup` then received that same array as the call's `output`.

## Consequences

- A tool that returns a URL image source, or a picture only as a file path, shows nothing.
