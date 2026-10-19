# claude-media-view

A Claude Code mod that shows images and GIFs inline in the terminal — and lets Claude see them too.

## What it does

- **Composer preview**: pictures of pasted images above the prompt while you write, labelled `#n` like their `[Image #n]` tags.
- **Transcript inline**: pictures under the rows that carry them — images Claude reads, images MCP tools answer with (such as a browser's screenshots), image files Claude names in its replies, and images you send. GIFs play, and pause while scrolled out of view.
- **Frames for Claude**: the `frames` tool hands Claude every frame of a GIF (sampled to at most 12 by default), so it sees the motion and not only the first frame.
- **Gallery**: `/media-view` opens a pane with every image of the session and when it showed in the chat, with buttons to copy its path or open it.
- **PNG, GIF and JPEG on macOS, Linux and Windows** with built-in decoders: nothing to install, no ffmpeg.

No network access, no telemetry, no self-update.

## Install

At the prompt of a Claude Code session:

```
/plugin install media-view --marketplace retogo/claude-media-view
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```sh
claude plugin install media-view --marketplace retogo/claude-media-view
```

## Use

| Command                | Does                                                    |
| ---------------------- | ------------------------------------------------------- |
| `/media-view`          | Opens the gallery, with the settings as a tab beside it |
| `/media-view settings` | Shows the settings tab: each kind of picture on or off  |
| `/media-view still`    | Shows transcript GIFs as still pictures                 |
| `/media-view animate`  | Plays transcript GIFs again (the default)               |

Every kind of picture is on by default; the settings are kept for later sessions. An image file named in a reply is drawn only where the Read tool may read it without asking.

Ask Claude to look at a GIF ("what happens in demo.gif?") and it can call the `frames` tool. It reads only what the Read tool may: your Read permission rules apply, and a path Read would ask about is put to you as a Read.

## Requirements

- Claude Code 2.1.301 or later
- A terminal with the kitty graphics protocol and Unicode placeholders: Ghostty or kitty. Elsewhere, media-view logs once why no picture is shown and how to fix it.
- In background sessions, tmux or agent view: add `"CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1"` to the `env` block of `~/.claude/settings.json`.

## Development

```sh
claude --plugin-dir .          # run a session with the mod loaded
claude plugin validate .       # check the manifests and the hooks module
claude plugin test .           # run the tests
```

The decisions behind the design, and what is not built yet, are in [docs/adr](docs/adr/README.md).

## License

MIT. Vendored code keeps its own license: jpeg-js (BSD-3-Clause and Apache-2.0) and fflate (MIT), see the headers in `hooks/domain/media/vendor/`.
