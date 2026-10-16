# 0014. The hooks module follows the loader's rules

- Status: Accepted
- Date: 2026-10-16

## Context

Claude Code reads a hooks module's source before it runs it, to learn what it calls and what state it touches. A module that breaks one of its rules does not load, and in a session that failure is silent. jarrodwatts/claude-image-view #11 and iamumeransari/claude-show-your-work #3 and #9 were loader refusals of this kind.

## Options

For each rule met, follow it, or restructure so the case does not arise.

## Decision

Four rules, each met when the module first broke it:

- A function that takes `$` from another file is a function declaration, not a function expression: past an import, `$` is followed only into declarations.
- An event without a matcher has one hook in the module, so `session.start` work is gathered into one hook.
- A state atom is a const of the file that reads or writes it, with literal `plugin` and `key`; it cannot be imported.
- Inside a hook, no binding is named `next`.

The module splits into files freely within these rules; only the files that touch `$` carry them.

## Evidence

Each was a `claude plugin test .` refusal (Claude Code 2.1.301), quoted:

- `$ is passed to "loadPicture", a name bound to a function expression, outside the hook's own file: past an import $ is followed only into a function declaration (function loadPicture($) { ... }), which a bundle of the module keeps as written`
- `on("session.start") is registered twice without a matcher; the first is at .../hooks/features/composer-preview.tsx:30`. Hooks with distinct matchers load side by side.
- `the state library's update takes a source the scan can read: a reference whose plugin and key are string literals, or what atom, memberOf or derive (imported from "claude-code") made of one, written there or in a const of this file`
- `"next" (the continuation) is declared again (shadowed); rename the inner binding`

## Consequences

- Every test loads the module, so a regression fails the whole test run with the loader's message (ADR 0016).
