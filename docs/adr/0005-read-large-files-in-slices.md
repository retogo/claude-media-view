# 0005. Files of 4 MiB and more are read in slices through a process

- Status: Accepted
- Date: 2026-10-16

## Context

`$.fs.read` refuses files over 4 MiB, and `$.process.run` keeps only the first 4 MiB of a child's output. Screen-recording GIFs and phone photos are often larger.

## Options

1. Refuse files over 4 MiB.
2. Read them through a process, in base64 slices that each fit in 4 MiB of output.

## Decision

Option 2, up to a cap that bounds the number of processes a file costs. The path is handed to the process in its environment, never in a shell string. `dd | base64` on macOS and Linux and `FileStream` in PowerShell on Windows are the readers each OS has without installing anything.

## Evidence

- A test answers `fs.stat` with 5 MiB and refuses `fs.read`; the frames tool reads the file in three slices and answers with the image.
- GNU `base64` wraps its output in lines, so whitespace is dropped before decoding.

## Consequences

- The Windows reader is not yet checked on a Windows host.
