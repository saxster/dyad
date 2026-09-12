import type {
  EarsCriterion,
  SpecBundle,
  UserStory,
} from "./spec_bundle_schemas";

const STORY_HEADING = /^### (\S+): (.+)$/;
const CRITERION_LINE =
  /^- Given (.*), when (.*), then (.*?)(?: VERIFY `([^`]+)`)?$/;

function parseStoriesFromLines(lines: string[]): UserStory[] {
  const stories: UserStory[] = [];
  let current: {
    story: UserStory;
    state: "need-narrative" | "in-criteria";
  } | null = null;

  for (const line of lines) {
    const heading = STORY_HEADING.exec(line);
    if (heading) {
      current = {
        story: {
          id: heading[1],
          title: heading[2],
          narrative: "",
          criteria: [],
        },
        state: "need-narrative",
      };
      stories.push(current.story);
      continue;
    }

    if (!current) {
      continue;
    }

    const criterion = CRITERION_LINE.exec(line);
    if (criterion) {
      const parsed: EarsCriterion = {
        id: `AC-${current.story.criteria.length + 1}`,
        given: criterion[1],
        when: criterion[2],
        then: criterion[3],
      };
      if (criterion[4]) {
        parsed.verificationContract = criterion[4];
      }
      current.story.criteria.push(parsed);
      continue;
    }

    if (current.state === "need-narrative" && line.trim() !== "") {
      if (line.trim() === "Acceptance criteria:") {
        current.state = "in-criteria";
        continue;
      }
      current.story.narrative = line;
      current.state = "in-criteria";
    }
  }

  return stories;
}

export function parseRequirementsMarkdown(md: string): UserStory[] {
  return parseStoriesFromLines(md.replace(/\r\n/g, "\n").split("\n"));
}

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
