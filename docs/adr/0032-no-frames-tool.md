# 0032. No frames tool: Claude reads a GIF's motion its own way

- Status: Accepted
- Date: 2026-10-20
- Supersedes: 0010, 0011, 0028

## Context

Read shows the model only a GIF's first frame. ADR 0010 gave Claude a `frames` tool that sampled up to 12 frames evenly and labelled each with its time, ADR 0011 held it to what Read may read, and ADR 0028 ordered the hooks so that the call observer saw its calls. A registered tool's definition rides in the context of every request of every session, while a GIF's motion matters in few of them. Claude also has its own ways to read a GIF: Pillow, ffmpeg, ImageIO through JavaScript for Automation, or PowerShell's System.Drawing.

## Options

1. Keep the frames tool.
2. Remove it, and let Claude read a GIF's frames with whatever the environment offers, asking the person when it offers nothing.

## Decision

Option 2. In the experiment below Claude answered every motion question right with and without the tool. Where the tool's even sample fell short (a word shown in one frame of 120, a time to the tenth of a second), Claude went on to read every frame with Bash anyway, and where ffmpeg was installed it often chose ffmpeg over the tool. The tool saved about two seconds and a twentieth of the cost on the GIFs it served, which does not pay for its definition in every other session. In auto mode the Bash calls it saved ask nothing of the person.

The PNG decoder served only the tool, which scaled a still before handing it to the model; drawing hands a PNG to `Image` as it is. It goes with the tool.

## Evidence

Six GIFs made with Pillow, each with a known answer: how often a ball touches the floor (48 frames), when a square appears (30 frames of 100 ms, at 2.2 s), which number of 1–10 never shows (9 frames), the order of six colours, where a moving square ends (20 frames), and a word shown in one frame of 120. Each ran twice under four conditions, 48 runs, as `claude -p "<question>" --output-format stream-json --verbose`, model `claude-opus-5-5`, with Bash allowed but global installs and the network denied, one run at a time, each in a directory holding only its GIF. The tool was withheld with `--disallowedTools mcp__media-view__frames`; ffmpeg 9.0.1 from nixpkgs was put on PATH or not.

| Condition       | Correct | Tool calls | Bash | Turns | Cost   | Time   | Input tokens |
| --------------- | ------- | ---------- | ---- | ----- | ------ | ------ | ------------ |
| Tool            | 12/12   | 1.9        | 0.8  | 2.9   | $0.218 | 13.4 s | 112k         |
| No tool         | 12/12   | 2.9        | 2.6  | 3.9   | $0.229 | 16.1 s | 147k         |
| No tool, ffmpeg | 12/12   | 3.2        | 2.8  | 4.2   | $0.232 | 17.6 s | 160k         |
| Tool, ffmpeg    | 12/12   | 2.8        | 2.0  | 3.8   | $0.229 | 14.8 s | 140k         |

- With the tool, the bounce, appear and flash questions were each followed by Bash reading every frame with Pillow.
- With the tool and ffmpeg, Claude skipped the tool for appear and flash in both runs and for bounce and colours in one, reading frames and their times with `ffprobe` and `ffmpeg`.
- Without the tool or ffmpeg, Claude used Pillow through `python3` or `uv run --with pillow`; with ffmpeg, `ffprobe -show_entries frame=pts_time,duration_time` and `ffmpeg -sseof` for the last frame.
- Every question was answered right in every run, so the questions did not tell accuracy apart, and a machine with neither Python nor ffmpeg was not tried.

## Consequences

- A GIF a tool or reply shows is drawn and plays as before; only the model's view of its frames is Claude's own to get.
- ADR 0012's bounds on PNG decoding no longer apply: no PNG is decoded. Its bounds on GIF and JPEG decoding do.
- The tests check the PNGs the module writes by inflating them and undoing their filters themselves.
