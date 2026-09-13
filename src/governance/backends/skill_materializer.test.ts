import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializeSkills } from "./skill_materializer";
import { DyadErrorKind } from "@/errors/dyad_error";

describe("materializeSkills", () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes both target files and cleans them up", async () => {
    const root = await mkdtemp(join(tmpdir(), "gov-skills-"));
    roots.push(root);

    const cleanup = await materializeSkills(
      root,
      [{ id: "use-pnpm", body: "Always use pnpm." }],
      ["claude", "codex"],
    );

    const claudeFile = join(root, ".claude", "skills", "use-pnpm", "SKILL.md");
    const codexFile = join(root, ".codex", "skills", "use-pnpm", "SKILL.md");
    const expected = "---\nid: use-pnpm\n---\nAlways use pnpm.";
    expect(await readFile(claudeFile, "utf8")).toBe(expected);
    expect(await readFile(codexFile, "utf8")).toBe(expected);

    // finally semantics: cleanup still runs after an artificial throw.
    try {
      throw new Error("boom");
    } catch {
      // intentional throw to prove the cleanup runs in finally
    } finally {
      await cleanup();
    }

    await expect(readFile(claudeFile, "utf8")).rejects.toThrow();
    await expect(readFile(codexFile, "utf8")).rejects.toThrow();
  });

  it("rejects frontmatter injection in id or body", async () => {
    const root = await mkdtemp(join(tmpdir(), "gov-skills-bad-"));
    roots.push(root);

    await expect(
      materializeSkills(
        root,
        [{ id: "x\n---\ninjected: true", body: "b" }],
        ["claude"],
      ),
    ).rejects.toMatchObject({
      name: "DyadError",
      kind: DyadErrorKind.Validation,
    });

    await expect(
      materializeSkills(
        root,
        [{ id: "ok-id", body: "---\nsecret: 1" }],
        ["claude"],
      ),
    ).rejects.toMatchObject({
      name: "DyadError",
      kind: DyadErrorKind.Validation,
    });
  });
});
