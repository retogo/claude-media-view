# 0016. CI validates and tests the module on three OSes

- Status: Accepted
- Date: 2026-10-16

## Context

A module that breaks a loader rule loads nothing and says nothing in a session (ADR 0014). The type declarations a type check needs are written by Claude Code when a session loads the mod, not by `claude plugin validate` or `claude plugin test`.

## Options

1. CI runs `claude plugin validate .` and `claude plugin test .`; the type check runs where a session has laid the types.
2. CI also starts a session to lay the types, then type-checks.
3. Commit a copy of the generated types and type-check against it.

## Decision

Option 1, on macOS, Linux and Windows, against the oldest Claude Code version tested and the latest. Option 2 needs an authenticated session in a public repository's CI, and option 3 pins types Claude Code rewrites on every update.

## Evidence

- In a copy without `.claude-plugin/types/`, `claude plugin validate .` then `claude plugin test .` left `.claude-plugin/` holding only `plugin.json`.
- Every loader refusal met so far failed every test with the loader's message.

## Consequences

- A type error reaches CI only if it also breaks a test.
- Whether `claude plugin test` runs without authentication in CI is confirmed by the first CI run.
