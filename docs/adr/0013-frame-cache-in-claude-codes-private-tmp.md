# 0013. The frame cache stays in Claude Code's private tmp directory

- Status: Accepted
- Date: 2026-10-16

## Context

Frame files are written by a process with shell redirection to paths derived from a hash of their source. On a shared `/tmp`, another local user could plant symlinks on such paths.

## Options

1. Harden every write: a 0700 directory checked for its owner, files created with `O_EXCL` and renamed into place.
2. Write inside the tmp directory Claude Code already keeps private to the user.

## Decision

Option 2. Claude Code makes its tmp root for the user (`claude-<uid>` under `CLAUDE_CODE_TMPDIR` or `/tmp`), so no other user can create entries inside it. Hardening each write would guard against a threat that directory already rules out.

## Evidence

`ls -ld /tmp/claude-$(id -u)` gives `drwx------ <user> wheel`: mode 0700, owned by the user, made by Claude Code before media-view runs.

## Consequences

- The safety rests on Claude Code keeping its tmp root private. Revisit if that changes.
- On Windows the root is under the user's own `%TEMP%`.
