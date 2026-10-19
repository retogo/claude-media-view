# 0026. The gallery shows what the chat shows, newest first

- Status: Accepted
- Date: 2026-10-19

## Context

The person turns kinds of picture off and on in the settings, and expects a change to reach the images already shown, in the chat and in the gallery. Transcript rows already follow it: each draw reads the settings, and a change to them redraws the rows. The gallery did not: it listed every image a row had drawn, under any setting, and put every paste before any tool's image, so an image Claude had just read sat below a session's worth of pastes and looked missing.

## Options

1. Drop an image's record when its setting turns off.
2. Keep each image's record with the setting it was drawn under, and list only those whose setting is on now.
3. Leave the gallery as a history of everything drawn.

## Decision

Option 2. A record dropped under option 1 comes back only when its row is drawn again, which the transcript does only for rows on screen, so turning a setting on again would not bring back the gallery's older images. Option 3 contradicts the setting.

A paste follows the setting of where it shows: in the draft, the setting for pastes above the prompt; once sent, the one for sent prompts.

Entries are ordered by when they showed in the chat, newest first. The draft's pastes come first, as they are about to show; images with no known time come last.

## Consequences

- Records kept before this change carry no setting; within a session that ran the older code they stay out of the gallery until a new session starts.
