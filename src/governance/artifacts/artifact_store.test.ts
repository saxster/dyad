import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ArtifactStore } from "./artifact_store";
import { parseSpecBundle } from "../core/spec_bundle_schemas";

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
});
