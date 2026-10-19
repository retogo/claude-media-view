# 0021. The gallery's records live in the session's state

- Status: Accepted
- Date: 2026-10-19

## Context

The gallery lists the images the transcript drew, and offers to show each in the chat by the row that drew it. That row is known only while a row is drawn, and the transcript draws only rows on screen. Kept in the module's own variables, the records were lost on every hot reload: older images lost their "Show in chat" button, and tools' images left the gallery, until their rows were drawn again.

## Options

1. Keep the records in the module's variables.
2. Keep them in the session's state (`$.state`), which a hot reload leaves.
3. Keep them in the plugin's store (`$.store`), which outlives the session too.

## Decision

Option 2. The gallery is this session's images; a resumed session is a new one and starts empty, so nothing needs to outlive the session. The first record of an image or a tag stands, so a row drawn again after a reload, which may know less (a Read's path), changes nothing.

A render may not write state, so each record is written once the render that found it is over.

## Evidence

- Writing state from a `ToolGroup` render was refused: `state.set: denied: it was made while ui.render is being dispatched, and drawing is pure (a render hook reads state and returns a tree; write from a handler such as onPress, or from another event)`.
- The hooks module types: `$.state` "survives a hot reload of the plugin's code", while `$.store` is "kept between sessions and hot reloads".

## Consequences

- The gallery lists an image a moment after its row is drawn, not in the same draw.
