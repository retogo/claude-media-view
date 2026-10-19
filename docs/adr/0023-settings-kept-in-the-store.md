# 0023. What media-view draws is the person's to choose, and kept across sessions

- Status: Accepted
- Date: 2026-10-19

## Context

Each kind of picture can be welcome or in the way: pastes above the prompt, pastes in sent prompts, images Claude reads, images tools answer with, image files named in replies, and moving GIFs. A setting chosen once should hold in the next session.

## Options

1. Commands only (`/media-view still`), kept for the session.
2. A settings pane of toggles, kept in the plugin's store (`$.store`), which outlives the session, and copied into the session's state (`$.state`) at session start.

## Decision

Option 2, every setting on by default. The settings are a pane of their own, opened with the gallery so the engine draws both as tabs: its tab row is the surface's own, and with both open the settings are always one tab away. The two are a pair: the person closing either closes both, while a close media-view made itself closes nothing more, so they never close each other in turn. Renders read the settings from state, so a toggle redraws what it touches at once; the store holds them for the next session. `/media-view still` and `animate` set the same GIF setting.

Tabs drawn inside one pane (a row of buttons, or a `Select`) were left aside: Claude Code has no tab element, and its own tab row already shows a plugin's panes side by side.

## Evidence

- A gallery that carried a Settings button beside the engine's "Media settings" tab read as the same control twice; with the settings pane alone and the gallery closed, the settings had no visible way in.

- The hooks module types: `$.state` "survives a hot reload"; `$.store` is "kept between sessions and hot reloads", "a JSON file of the plugin's own under the user's Claude Code configuration directory". A render that reads state is drawn again when it changes.

## Consequences

- The store is a file the person or an older version may have written: a setting missing or not a yes or no reads as its default.
