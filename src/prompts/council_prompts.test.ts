import { describe, expect, it } from "vitest";
import { buildCouncilSystemPrompt } from "./council_prompts";

const JSON_PROTOCOL =
  'Respond with ONLY a JSON object: {"findings":[{"severity":"critical"|"major"|"minor","claim":"...","evidence":"..."}]}';

const MEMBER_IDS = [
  "architect",
  "pragmatist",
  "fact-checker",
  "devils-advocate",
] as const;

describe("buildCouncilSystemPrompt", () => {
  it("embeds each member's razors in the round-1 prompt", () => {
    const architect = buildCouncilSystemPrompt("architect", 1);
    expect(architect).toContain("Occam");
    expect(architect).toContain("Chesterton's Fence");
    expect(architect).toMatchSnapshot();

    const pragmatist = buildCouncilSystemPrompt("pragmatist", 1);
    expect(pragmatist).toContain("YAGNI");
    expect(pragmatist).toContain("Inversion");
    expect(pragmatist).toMatchSnapshot();

    const factChecker = buildCouncilSystemPrompt("fact-checker", 1);
    expect(factChecker).toContain("factual rigor");
    expect(factChecker).toContain("cite");
    expect(factChecker).toMatchSnapshot();

    const devilsAdvocate = buildCouncilSystemPrompt("devils-advocate", 1);
    expect(devilsAdvocate).toContain("Pre-Mortem");
    expect(devilsAdvocate).toMatchSnapshot();
  });

  it("carries prior round texts into round-2 prompts", () => {
    const prompt = buildCouncilSystemPrompt("pragmatist", 2, {
      architect: "The migration plan doubles the schema surface",
      pragmatist: "pragmatist's own claim must not appear",
    });
    expect(prompt).toContain("The migration plan doubles the schema surface");
    expect(prompt).not.toContain("pragmatist's own claim must not appear");
    expect(prompt).toMatchSnapshot();
  });

  it("demands the JSON findings protocol", () => {
    for (const memberId of MEMBER_IDS) {
      expect(buildCouncilSystemPrompt(memberId, 1)).toContain(JSON_PROTOCOL);
    }
  });
});
