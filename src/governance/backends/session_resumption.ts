import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface SessionRecord {
  backend: string;
  sessionId: string;
  cwd: string;
  savedAt: string;
}

const MAX_SESSION_AGE_MS = 24 * 3_600_000;

export async function saveSession(
  root: string,
  session: { backend: string; sessionId: string; cwd: string },
): Promise<void> {
  const dir = join(root, ".dyad", "sessions");
  await mkdir(dir, { recursive: true });
  const record: SessionRecord = {
    ...session,
    savedAt: new Date().toISOString(),
  };
  await writeFile(
    join(dir, `${session.backend}.json`),
    JSON.stringify(record),
    { mode: 0o600 },
  );
}

export async function loadSession(
  root: string,
  backend: string,
  now: Date = new Date(),
): Promise<SessionRecord | null> {
  let raw: string;
  try {
    raw = await readFile(
      join(root, ".dyad", "sessions", `${backend}.json`),
      "utf8",
    );
  } catch {
    return null;
  }
  try {
    const record = JSON.parse(raw) as SessionRecord;
    const ageMs = now.getTime() - new Date(record.savedAt).getTime();
    if (ageMs > MAX_SESSION_AGE_MS) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}
