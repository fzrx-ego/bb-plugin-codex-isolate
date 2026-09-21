# Codex isolate

A [BB](https://getbb.app) plugin that gives BB Codex its own `CODEX_HOME`, so Cursor ChatGPT cannot pin writer locks on the same session files. The Codex login stays shared.

## Install

```
bb plugin install git:https://github.com/fzrx-ego/bb-plugin-codex-isolate.git@semver:^0.1.0
```

## What it does

- Sets `CODEX_HOME` to `~/.bb/codex-home`
- Keeps `sessions` and `thread-writer-locks` as real directories there
- Symlinks `auth.json`, `config.toml`, `AGENTS.md`, `skills`, and `plugins` to `~/.codex`
- If a Codex thread still fails with `already has an active writer`, stops the runtime and retries, at most twice

## Note

Isolation is requested through BB's `experimental_contributeEnv`. The Codex host in current BB builds forwards only pool env vars into the app-server process, so `CODEX_HOME` may not take effect until BB forwards contributed variables. The retry still runs either way.

## Develop

```
bb plugin build .
bb plugin install .
```
