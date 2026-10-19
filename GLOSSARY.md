# Glossary

The words this project uses, and where they come from. Claude Code's own names are used as they are; the rest are this project's.

## Claude Code's names

| Word          | Meaning                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------- |
| `AbovePrompt` | The band drawn above the prompt; `ui.render` component                                        |
| `ToolGroup`   | A run of tool calls folded into one line ("Read 2 files"); `ui.render` component              |
| `ToolResult`  | The result block under a standalone tool row; `ui.render` component                           |
| `UserMessage` | A user-role transcript row: a sent prompt; `ui.render` component                              |
| `AssistantMessage` | A reply's text row; `ui.render` component |
| `Pane`        | A pane the mod opens; `ui.render` component, its id the `requestId`                           |
| `Image`       | The terminal element that draws a picture through the kitty graphics protocol                 |
| `[Image #n]`  | The tag Claude Code puts in a prompt for the n-th pasted image                                |
| `Read`        | The built-in tool; its image output is `{ type: 'image', file: { base64, type } }`            |
| content block | One block of an API message or tool result; an image is `{ type: 'image', source: { type: 'base64', data } }`, as MCP tools answer |
| `blit`        | `$.ui.blit`: swapping a keyed `Image`'s source without a redraw; refused with a `deny` reason |
| `requestId`   | The instance a render draws: a tool row's `tool_use_id`, a message's id, a pane's id          |

## Usecase folders

Each folder names the event its usecases answer; the file names the matcher's value.

| Folder          | Event                                                             |
| --------------- | ----------------------------------------------------------------- |
| `renders/`      | `ui.render`, by `component` (`pane/` adds the pane's `requestId`) |
| `toolCalls/`    | `tool.call`, by the tool's short name; `anyTool` for every call   |
| `commandRuns/`  | `command.run`, by command                                         |
| `closes/`       | `ui.close`, by pane id                                            |
| `sessionStarts` | `session.start`                                                   |
| `promptSubmits` | `prompt.submit`                                                   |

## This project's words

| Word          | Meaning                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| image tag     | `[Image #n]`, by its number `n`                                                                      |
| draft | The prompt being written, read with `$.prompt.read()` |
| tile | One picture in the `AbovePrompt` band, labelled with its image tag number |
| gallery | The media-view `Pane`: every image the chat shows under the show settings that are on, opened with `/media-view` |
| kept frame | A GIF frame kept by sampling; it shows until the next kept frame |
| paste cache   | The folder Claude Code writes pasted images to: `<tmp root>/<project>/<session>/images/<n>.<ext>`    |
| picture       | A decoded image on disk: its size and its frames, each a file source for `Image`                     |
| frame cache   | `<tmp root>/media-view/<key hash>/`, where pictures are written once                                 |
| converted format | WebP, HEIC or TIFF: an image its converter turns into a PNG, or an animated WebP into a GIF, in the frame cache before it is decoded |
| converter | What converts a converted format: the OS's codecs (macOS, Windows), or an ffmpeg the person installed, on any OS |
| cell box      | The columns and rows of terminal cells a picture is drawn in                                         |
| seen image    | An image the transcript drew from a tool's result, kept with the row (`requestId`) that drew it and its path (a Read's) or its tool (an MCP tool's), and the show setting it was drawn under |
| shown at      | When an image showed in the chat: its tool call answered, or its prompt was sent from the composer |
| settings      | Where media-view shows images, whether GIFs play, whether the converted formats are converted, and whether by ffmpeg, each on or off; kept in the plugin's store |
| show setting  | A setting that lets images be shown in one place (above the prompt, under sent prompts, tool calls or replies), in the chat and in the gallery alike |
| blit loop     | A timer swapping a GIF's frames on one keyed `Image` until stopped                                   |
| terminal deny | A blit refused because the terminal draws the `Image`'s alt here, not because it was not mounted yet |
