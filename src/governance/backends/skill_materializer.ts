import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export interface SkillToMaterialize {
  id: string;
  body: string;
}

export type SkillTarget = "claude" | "codex";

const TARGET_DIRS: Record<SkillTarget, string> = {
  claude: ".claude",
  codex: ".codex",
};

/**
 * Writes each skill as `<target>/skills/<id>/SKILL.md` (YAML frontmatter with
 * the id, then the body) for every target, and returns a cleanup that removes
 * the written files. Callers should run the cleanup in a finally block.
 * Bodies and ids that could inject frontmatter (`---` lines) are rejected.
 */
export async function materializeSkills(
  root: string,
  skills: SkillToMaterialize[],
  targets: SkillTarget[],
): Promise<() => Promise<void>> {
  for (const skill of skills) {
    if (
      skill.body.startsWith("---") ||
      skill.id.includes("---\n") ||
      skill.body.includes("---\n")
    ) {
      throw new DyadError(
        `skill "${skill.id}" could inject frontmatter and was rejected`,
        DyadErrorKind.Validation,
      );
    }
  }

  const written: string[] = [];
  for (const skill of skills) {
    for (const target of targets) {
      const dir = join(root, TARGET_DIRS[target], "skills", skill.id);
      await mkdir(dir, { recursive: true });
      const file = join(dir, "SKILL.md");
      const frontmatter = `---\nid: ${skill.id.replaceAll('"', '\\"')}\n---\n`;
      await writeFile(file, frontmatter + skill.body);
      written.push(file);
    }
  }

  return async () => {
    await Promise.all(written.map((file) => rm(file, { force: true })));
  };
}
