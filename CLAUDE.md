# CLAUDE.md

media-view is a Claude Code mod (a plugin whose `hooks/hooks.json` lists a hooks module). English is the project language: code, comments, docs, commit messages and PR text.

## The code says what; ADRs say why

Code and `README.md` describe the present as if it had always been this way: what it does, never how it got here. The reason for a single value or a local choice goes in a comment beside it.

An ADR under `docs/adr/` (format and index in `docs/adr/README.md`) keeps only what reading the code cannot tell:

- a choice between options, with the ones not taken
- constraints from outside the code: Claude Code, the API, terminals, licences
- spike and experiment results, with commands, inputs and observed outputs
- dead ends, workarounds, and why something was reverted

File names, function names, constants and the steps of an algorithm stay out of ADRs. Write the ADR in the same change as the decision, add it to the index, and link it from the code that applies it. A changed decision gets a new ADR that supersedes the old one; a changed value or name needs none.

## Layers and names

Code goes in `hooks/domain` (pure), `hooks/usecases` (decisions through ports, returning plain data) or `hooks/adapters` (`$`, JSX, timers); `hooks/register.tsx` wires hooks to usecases. Dependencies point inward, and only `register.tsx` and `adapters/` touch `$`. A usecase is named after the Claude Code event it answers (`renders/toolGroup.ts`, `toolCalls/anyTool.ts`), and every domain word is the one in `GLOSSARY.md`; a new word goes into `GLOSSARY.md` in the same change.

## Releases

Tests cannot see pixels. Before a release, check pictures by hand in Ghostty and kitty, in a foreground and a background session: a paste above the prompt, a read PNG and GIF in the transcript, an image file named in a reply, and the gallery.

## Probes

Spikes run in a throwaway mod outside this repository. Only their findings land here, as ADR evidence.
