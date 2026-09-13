import { describe, expect, it } from "vitest";
import {
  nextIncubationStage,
  type CommittedHypothesis,
} from "./incubation_state";

const hypothesis: CommittedHypothesis = {
  problem: "New chats lose every prior decision",
  hypothesis: "Injecting project memory into governed turns fixes re-briefing",
  successCriteria: ["New chats recall prior decisions unprompted"],
};

describe("nextIncubationStage", () => {
  it("advances one stage at a time", () => {
    expect(nextIncubationStage("ideate", { type: "advance" })).toBe("specify");
    expect(nextIncubationStage("specify", { type: "advance" })).toBe(
      "challenge",
    );
    expect(
      nextIncubationStage("challenge", { type: "advance", hypothesis }),
    ).toBe("commit");
    expect(nextIncubationStage("commit", { type: "advance" })).toBe("build");
  });

  it("rejects advancing into commit without a hypothesis payload", () => {
    expect(() => nextIncubationStage("challenge", { type: "advance" })).toThrow(
      "hypothesis payload required",
    );
    expect(() =>
      nextIncubationStage("challenge", {
        type: "advance",
        hypothesis: { ...hypothesis, successCriteria: [] },
      }),
    ).toThrow("hypothesis payload required");
    expect(() =>
      nextIncubationStage("challenge", {
        type: "advance",
        hypothesis: {
          problem: "",
          hypothesis: "H",
          successCriteria: ["S1"],
        },
      }),
    ).toThrow("hypothesis payload required");
  });

  it("rejects stage jumps and terminal overruns", () => {
    expect(() =>
      nextIncubationStage("ideate", { type: "advance", to: "build" }),
    ).toThrow("invalid incubation transition: ideate → build");
    expect(() => nextIncubationStage("build", { type: "advance" })).toThrow(
      "build is the final incubation stage",
    );
    expect(() =>
      nextIncubationStage("challenge", { type: "regress", to: "ideate" }),
    ).toThrow("invalid incubation transition: challenge → ideate");
    expect(() => nextIncubationStage("ideate", { type: "regress" })).toThrow(
      "ideate is the first incubation stage",
    );
  });

  it("regresses exactly one stage", () => {
    expect(nextIncubationStage("specify", { type: "regress" })).toBe("ideate");
    expect(nextIncubationStage("challenge", { type: "regress" })).toBe(
      "specify",
    );
    expect(nextIncubationStage("build", { type: "regress" })).toBe("commit");
    // Regression into commit does not demand a new hypothesis payload.
    expect(nextIncubationStage("commit", { type: "regress" })).toBe(
      "challenge",
    );
  });
});
