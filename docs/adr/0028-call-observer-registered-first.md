# 0028. The hook that watches every tool call is registered first

- Status: Superseded by 0032
- Date: 2026-10-19

## Context

The gallery's time for a tool's image is kept when the call answers (ADR 0020), by a `tool.call` hook on every tool that awaits `next` and reads the result. Images the `frames` tool answered with showed in the gallery with no time, and so sorted last.

## Options

1. Keep the time in each tool's own hook, such as the one that answers `frames`.
2. Register the hook on every tool before every other `tool.call` hook of the plugin.

## Decision

Option 2. A plugin's hooks nest in the order they are registered, first outermost, and a hook that answers a call without `next` hides it from every hook inside it. Registered first, the watching hook sees every call that reaches the plugin, its own tools' and any added later included, where option 1 covers only the tools it is written into.

## Evidence

- The hooks module types, on `on`: "a plugin's registrations nest in order, first outermost".
- A test's own `tool.call` hook on `mcp__media-view__frames`, which calls `next`, never ran for a `frames` call: the plugin's hook answered it first.

## Consequences

- A tool another plugin answers from a tier or place outside this one, without `next`, is never seen here; its images show with no time, last in the gallery.
