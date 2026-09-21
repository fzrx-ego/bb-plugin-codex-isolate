Gives BB Codex its own session folder so Cursor ChatGPT cannot lock the same threads. The login stays the shared `~/.codex` one.

## Who it is for

People who run Codex in BB and in Cursor on the same machine and hit `already has an active writer`.

## What you get

BB Codex sessions live under `~/.bb/codex-home`. Auth and config still come from `~/.codex` via symlinks. If a lock remains, the plugin retries the failed thread twice.

## First step

Install the plugin, start a Codex thread in BB while Cursor also has a Codex chat open, and confirm BB does not fail on the writer lock.
