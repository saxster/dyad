import type { SpecBundle, UserStory } from "./spec_bundle_schemas";

function renderStory(story: UserStory): string {
  const lines: string[] = [];
  lines.push(`### ${story.id}: ${story.title}`);
  lines.push("");
  lines.push(story.narrative);
  lines.push("");
  if (story.criteria.length > 0) {
    lines.push("Acceptance criteria:");
    lines.push("");
    for (const criterion of story.criteria) {
      let line = `- Given ${criterion.given}, when ${criterion.when}, then ${criterion.then}`;
      if (criterion.verificationContract) {
        line += ` VERIFY \`${criterion.verificationContract}\``;
      }
      lines.push(line);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderRequirementsMarkdown(bundle: SpecBundle): string {
  const sections = bundle.stories.map(renderStory);
  return [`## User Stories`, ""].concat(sections).join("\n");
}
