# 0015. Layers, and usecases named after Claude Code's events

- Status: Accepted
- Date: 2026-10-16

## Context

The module was first split by feature, each file mixing decisions (what to draw, what to send the model) with engine calls, JSX and state. Most behaviour could be tested only by mounting it through the test kit, and the features carried this project's own names, not Claude Code's.

## Options

Layering:

1. Feature files.
2. `domain` (pure), `usecases` (decisions through ports, returning plain data), `adapters` (`$`, JSX, timers), with one composition root.

Naming usecases after the hook each answers:

- A. Claude Code's names verbatim (`ui.render/AbovePrompt.ts`): dots and capitals make poor paths.
- B. Kebab case (`ui-render/above-prompt.ts`): unlike the code's identifiers.
- C. The event as a plural noun and the matcher's value in camel case (`renders/abovePrompt.ts`, `toolCalls/frames.ts`).

## Decision

Option 2 with naming C. A reader finds the code for a Claude Code event by its name, and decisions are tested with fake ports. Domain words come from `GLOSSARY.md`, which maps this project's folder nouns back to Claude Code's events.

## Evidence

A spike passed a function declaration returning a port over `$` into a usecase. `claude plugin validate` listed the call through it and passed, and tests with a fake port and through `$.command.run` both passed: the loader rules (ADR 0014) hold with ports.

## Consequences

- One more indirection per engine call, and more files.
