import { describe, expect, it } from "vitest";
import { constructSpecModePrompt } from "./spec_mode_prompt";

describe("constructSpecModePrompt", () => {
  it("matches the committed spec-mode prompt snapshot", () => {
    expect(
      constructSpecModePrompt("# Tech Stack\nReact, Tailwind"),
    ).toMatchSnapshot();
  });

  it("instructs gathering context via planning_questionnaire", () => {
    const prompt = constructSpecModePrompt(undefined);

    expect(prompt).toContain("planning_questionnaire");
  });

  it("instructs producing EARS stories with Given/When/Then and MoSCoW", () => {
    const prompt = constructSpecModePrompt(undefined);

    expect(prompt).toContain("Given");
    expect(prompt).toContain("When");
    expect(prompt).toContain("Then");
    expect(prompt).toContain("must");
    expect(prompt).toContain("should");
    expect(prompt).toContain("could");
    expect(prompt).toContain("wont");
  });

  it("instructs a verificationContract per objectively checkable criterion", () => {
    const prompt = constructSpecModePrompt(undefined);

    expect(prompt).toContain("verificationContract");
    expect(prompt).toContain("exit 0");
  });

  it("instructs a not-doing list and a risk register", () => {
    const prompt = constructSpecModePrompt(undefined);

    expect(prompt).toContain("notDoingList");
    expect(prompt).toContain("risk");
  });

  it("presents the spec via write_spec and gates exit_plan on approval", () => {
    const prompt = constructSpecModePrompt(undefined);

    expect(prompt).toContain("write_spec");
    expect(prompt).toContain("exit_plan");
    expect(prompt.indexOf("write_spec")).toBeLessThan(
      prompt.indexOf("exit_plan"),
    );
  });
});
