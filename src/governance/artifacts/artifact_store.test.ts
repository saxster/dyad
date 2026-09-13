import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  ArtifactStore,
  appendTranscript,
  exportVerificationScripts,
  loadIncubationSession,
  saveIncubationSession,
} from "./artifact_store";
import { parseSpecBundle } from "../core/spec_bundle_schemas";
import type { SpecBundle } from "../core/spec_bundle_schemas";
import { DyadErrorKind } from "@/errors/dyad_error";

const execAsync = promisify(exec);

const FIXTURE_PATH = resolve(
  __dirname,
  "../__fixtures__/spec_bundle.fixture.json",
);

describe("ArtifactStore", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function makeStore(): Promise<ArtifactStore> {
    const root = await mkdtemp(join(tmpdir(), "gov-artifacts-"));
    roots.push(root);
    return new ArtifactStore(root);
  }

  it("writes bundle.json and loads it back", async () => {
    const store = await makeStore();
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));

    await store.saveBundle(bundle);

    expect(existsSync(join(store.root, ".dyad", "specs", "bundle.json"))).toBe(
      true,
    );
    expect(await store.loadBundle()).toEqual(bundle);
  });

  it("snapshots each save into history with a version stamp", async () => {
    const store = await makeStore();
    const v1 = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));

    await store.saveBundle(v1);

    const mutated = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    mutated.stories = [
      {
        ...mutated.stories[0],
        title: "Mutated title",
      },
      ...mutated.stories.slice(1),
    ];

    await store.saveBundle(mutated);

    const history = await store.listHistory();
    expect(history.map((entry) => entry.version)).toEqual([1, 2]);
    expect(history[0].bundle.stories[0].title).toBe(
      "Maintainer Export Deterministic Verification Scripts",
    );
    expect(history[1].bundle.stories[0].title).toBe("Mutated title");
  });

  it("also writes requirements.md next to bundle.json", async () => {
    const store = await makeStore();
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));

    await store.saveBundle(bundle);

    const mdPath = join(store.root, ".dyad", "specs", "requirements.md");
    expect(existsSync(mdPath)).toBe(true);
    const md = readFileSync(mdPath, "utf8");
    expect(md).toContain(
      `### ${bundle.stories[0].id}: ${bundle.stories[0].title}`,
    );
  });

  it("refuses to save an unparseable bundle", async () => {
    const store = await makeStore();
    const unparseable = {
      stories: "not-a-story-array",
    } as unknown as SpecBundle;

    await expect(store.saveBundle(unparseable)).rejects.toMatchObject({
      name: "DyadError",
      kind: DyadErrorKind.Validation,
    });
    expect(existsSync(join(store.root, ".dyad", "specs", "bundle.json"))).toBe(
      false,
    );
  });

  it("exports standalone verify-*.sh scripts and an index", async () => {
    const store = await makeStore();
    const bundle = parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8"));
    const withContracts: SpecBundle = {
      ...bundle,
      stories: [
        {
          id: "US-1",
          title: "Has contract",
          narrative:
            "As a maintainer I want a checkable criterion so that it is verifiable",
          criteria: [
            {
              id: "AC-1",
              given: "the root exists",
              when: "the manifest is checked",
              then: "it is present",
              verificationContract: "test -f package.json",
            },
          ],
        },
        {
          id: "US-2",
          title: "No contract",
          narrative:
            "As a maintainer I want a manual criterion so that humans verify it",
          criteria: [
            {
              id: "AC-1",
              given: "the design is open",
              when: "a reviewer reads it",
              then: "it looks right",
            },
          ],
        },
      ],
    };
    await writeFile(join(store.root, "package.json"), "{}\n");

    await exportVerificationScripts(store.root, withContracts);

    const scriptPath = join(store.root, ".dyad", "bin", "verify-US-1-AC-1.sh");
    expect(existsSync(scriptPath)).toBe(true);
    await expect(execAsync(`sh '${scriptPath}'`)).resolves.toBeTruthy();

    const index = JSON.parse(
      readFileSync(
        join(store.root, ".dyad", "bin", "verification-tasks.json"),
        "utf8",
      ),
    );
    expect(index).toEqual({
      binDirectoryRelativePath: ".dyad/bin",
      exportedScripts: [
        {
          argv: ["test", "-f", "package.json"],
          scriptRelativePath: ".dyad/bin/verify-US-1-AC-1.sh",
          criterionKey: "US-1/AC-1",
          verificationContract: "test -f package.json",
        },
      ],
      skippedTasks: [
        { criterionKey: "US-2/AC-1", reason: "no verification contract" },
      ],
    });

    const readme = readFileSync(
      join(store.root, ".dyad", "bin", "README.md"),
      "utf8",
    );
    expect(readme).toContain("verify-US-1-AC-1.sh");
    expect(readme).toContain("no verification contract");
  });
});

describe("incubation session persistence", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function makeRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "gov-incubation-"));
    roots.push(root);
    return root;
  }

  it("saves and loads an incubation session round-trip", async () => {
    const root = await makeRoot();
    const session = {
      id: "incub-1",
      stage: "ideate" as const,
      createdAt: "2026-09-14T10:00:00.000Z",
      hypothesis: {
        problem: "New chats lose every prior decision",
        hypothesis: "Project memory injection fixes re-briefing",
        successCriteria: ["New chats recall prior decisions unprompted"],
      },
    };

    await saveIncubationSession(root, session);
    const loaded = await loadIncubationSession(root, "incub-1");

    expect(loaded).toEqual(session);
  });

  it("appends transcript lines and reads them back CRLF-safe", async () => {
    const root = await makeRoot();
    await appendTranscript(root, "incub-1", "first line");
    await appendTranscript(root, "incub-1", "second line");

    const raw = await readFile(
      join(root, ".dyad", "incubation", "sessions", "incub-1", "transcript.md"),
      "utf8",
    );
    expect(raw.split(/\r?\n/)).toEqual(["first line", "second line", ""]);
  });
});
