import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const GOVERNANCE_ROOT = join(__dirname, "..");

async function governanceSources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await governanceSources(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

describe("governance engine electron independence", () => {
  it("imports electron nowhere under src/governance", async () => {
    const sources = await governanceSources(GOVERNANCE_ROOT);
    expect(sources.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of sources) {
      const contents = await readFile(file, "utf8");
      // Matches `from "electron"`, `import "electron"`, and `import x from 'electron'`.
      if (
        /import\s+[^;]*from\s+["']electron["']|import\s+["']electron["']/.test(
          contents,
        )
      ) {
        offenders.push(relative(GOVERNANCE_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
