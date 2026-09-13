import { execFile } from "node:child_process";
import { mkdir, mkdtemp, copyFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const DYADCTL = resolve(process.cwd(), "scripts/dyadctl.mjs");

function bundleJson(verificationContract: string): string {
  return JSON.stringify({
    id: "bundle-1",
    version: 1,
    rawIntent: "fixture",
    approvalStatus: "approved",
    createdAt: "2026-09-14T00:00:00.000Z",
    notDoingList: [],
    provenance: {},
    stories: [
      {
        id: "US-1",
        title: "Has a package manifest",
        narrative: "As a maintainer I want the app to be importable",
        criteria: [
          {
            id: "AC-1",
            given: "the app directory",
            when: "the package manifest is checked",
            then: "it exists",
            verificationContract,
          },
        ],
      },
    ],
  });
}

describe("dyadctl run", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function makeApp(bundle: string | null): Promise<string> {
    const appDir = await mkdtemp(join(tmpdir(), "dyadctl-app-"));
    roots.push(appDir);
    await copyFile(
      resolve(
        process.cwd(),
        "e2e-tests/fixtures/import-app/minimal/package.json",
      ),
      join(appDir, "package.json"),
    );
    if (bundle !== null) {
      await mkdir(join(appDir, ".dyad", "specs"), { recursive: true });
      await writeFile(join(appDir, ".dyad", "specs", "bundle.json"), bundle);
    }
    return appDir;
  }

  it.runIf(process.platform !== "win32")(
    "runs the bundle's contracts and reports green",
    async () => {
      const appDir = await makeApp(bundleJson("test -f package.json"));

      const { stdout } = await execFileAsync(process.execPath, [
        DYADCTL,
        "run",
        "--app",
        appDir,
        "--prompt",
        "x",
        "--json",
      ]);

      const report = JSON.parse(stdout);
      expect(report).toEqual({
        status: "completed",
        verifications: [{ key: "US-1/AC-1", status: "green", exitCode: 0 }],
        versions: [],
      });
    },
    60_000,
  );

  it.runIf(process.platform !== "win32")(
    "reports red for a failing contract",
    async () => {
      const appDir = await makeApp(bundleJson("test -f missing.txt"));

      const { stdout } = await execFileAsync(process.execPath, [
        DYADCTL,
        "run",
        "--app",
        appDir,
        "--prompt",
        "x",
        "--json",
      ]);

      const report = JSON.parse(stdout);
      expect(report.status).toBe("completed");
      expect(report.verifications).toEqual([
        { key: "US-1/AC-1", status: "red", exitCode: 1 },
      ]);
    },
    60_000,
  );

  it.runIf(process.platform !== "win32")(
    "reports empty verifications when the app has no bundle",
    async () => {
      const appDir = await makeApp(null);

      const { stdout } = await execFileAsync(process.execPath, [
        DYADCTL,
        "run",
        "--app",
        appDir,
        "--prompt",
        "x",
        "--json",
      ]);

      expect(JSON.parse(stdout)).toEqual({
        status: "completed",
        verifications: [],
        versions: [],
      });
    },
    60_000,
  );
});
