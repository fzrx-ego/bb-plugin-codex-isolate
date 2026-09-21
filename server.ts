import { homedir } from "node:os";
import { lstat, mkdir, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import type { BbPluginApi } from "@get-bb/plugin-sdk";

const CODEX_HOME = join(homedir(), ".bb", "codex-home");
const SHARED_CODEX_HOME = join(homedir(), ".codex");
const WRITER_LOCK_ERROR = "already has an active writer";
const MAX_RETRY_ATTEMPTS = 2;
const writerLockRetries = new Map<string, number>();

async function ensureLink(fromName: string): Promise<void> {
  const target = join(SHARED_CODEX_HOME, fromName);
  const link = join(CODEX_HOME, fromName);
  try {
    await symlink(target, link);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "EEXIST") throw error;
  }
}

async function assertPrivateDir(relativeName: string): Promise<void> {
  const path = join(CODEX_HOME, relativeName);
  await mkdir(path, { recursive: true });
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`${path} must be a real directory, not a symlink`);
  }
  const resolved = await realpath(path);
  const shared = await realpath(SHARED_CODEX_HOME).catch(() => SHARED_CODEX_HOME);
  if (resolved === shared || resolved.startsWith(`${shared}/`)) {
    throw new Error(`${path} resolves inside ${SHARED_CODEX_HOME}`);
  }
}

async function ensureIsolatedHome(): Promise<void> {
  await mkdir(CODEX_HOME, { recursive: true });
  await assertPrivateDir("sessions");
  await assertPrivateDir("thread-writer-locks");
  await ensureLink("auth.json");
  await ensureLink("config.toml");
  await ensureLink("AGENTS.md");
  await ensureLink("skills");
  await ensureLink("plugins");
}

export default async function plugin(bb: BbPluginApi): Promise<void> {
  await ensureIsolatedHome();

  bb.providers.experimental_contributeEnv("codex", async () => [
    {
      name: "CODEX_HOME",
      value: CODEX_HOME,
      reason:
        "Keep BB Codex sessions and writer locks out of ~/.codex so Cursor ChatGPT cannot block turn.submit",
    },
  ]);

  bb.events.on("thread.failed", async ({ thread, error }) => {
    if (thread.providerId !== "codex") return;
    if (!error?.includes(WRITER_LOCK_ERROR)) return;
    const attempt = (writerLockRetries.get(thread.id) ?? 0) + 1;
    writerLockRetries.set(thread.id, attempt);
    if (attempt > MAX_RETRY_ATTEMPTS) return;

    bb.log.warn(
      `codex writer lock on ${thread.id}; stopping runtime and retrying (${attempt}/${MAX_RETRY_ATTEMPTS})`,
    );
    try {
      await bb.sdk.threads.stop({ threadId: thread.id });
    } catch (stopError) {
      bb.log.warn(
        `thread stop before writer-lock retry failed: ${
          stopError instanceof Error ? stopError.message : String(stopError)
        }`,
      );
    }
    await bb.sdk.threads.retry({
      threadId: thread.id,
      reason: "Codex writer lock: restart runtime in isolated CODEX_HOME",
    });
  });
}
