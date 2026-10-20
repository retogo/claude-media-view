# 0011. The frames tool reads only what Read may

- Status: Superseded by 0032
- Date: 2026-10-16

## Context

The frames tool reads any path the model names. Claude Code raises `tool.check` inside `tool.call`'s `next`, and a tool registered with `$.tool.register` is answered by a hook without `next`, so no permission check runs for it at all, not even the tool's own. `ToolSpec` has no permission field, and no API opens the permission dialog from a hook.

## Options

1. Call `next(e)` first, so the engine checks the tool's own permission, then answer.
2. A `tool.check` hook on the tool that takes Read's verdict where it is stricter.
3. Gate the read on Read's verdict for the same path: `$.tool.check` for Read, and for an `ask`, a `$.tool.call` of Read, which runs Read's own permission path, dialog included.
4. Always call Read through `$.tool.call` and read its outcome.

## Decision

Option 3. The tool reads files as Read does, so Read's rules and mode decide: `allow` reads, `deny` refuses with Read's reason, and `ask` puts a Read of the path to the person (or the mode's decider) and refuses when that is refused. Files that are not images are refused before any permission is asked.

Option 1 would read an engine failure as consent. Option 2 never runs. Option 4 cannot tell a refusal from Read failing on its own.

## Evidence

Headless runs (`claude -p --model haiku --plugin-dir .`), a `Read(//…/secret.png)` deny rule:

- Before the gate, the tool returned the denied image, with and without `--allowedTools`. The debug log held no `tool.check` for the call; a built-in Read in the same setup raised one.
- A probe tool whose hook called `next(e)` was checked (a `tool.check` hook's deny reached the model, `dontAsk` refused it), and with the check passed the call failed with `registered the tool … but no tool.call hook answered this call`.
- `$.tool.check` for Read gives the same deny for a path written relative, with `./` or absolute.
- `$.tool.call` of Read answers `{ deny }` for an `ask` nobody can answer, but `isError` with `File is in a directory that is denied by your permission settings.` for a deny rule, and `isError` too when Read fails to resize a 30 MB GIF.
- With the gate: the denied path is refused with Read's reason, an allowed PNG is answered, and an `ask` rule in `-p` is refused with "you haven't granted it yet".

## Consequences

- A rule on the frames tool itself has no effect. Classic `PreToolUse` hooks for Read run only on the `ask` path.
- A "yes, once" covers one call; the next call on the path asks again.
- Under `ask`, a path Read cannot process is refused with Read's error even after a yes.
- Not yet checked: the dialog an `ask` raises in an interactive session.
- Revisit if Claude Code checks permissions for hook-served tools.
