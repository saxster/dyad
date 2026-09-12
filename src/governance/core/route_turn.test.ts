import { describe, expect, it } from "vitest";
import { routeTurn } from "./route_turn";

describe("routeTurn", () => {
  it("routes a benign prompt in plan mode to lean direct planning", () => {
    expect(
      routeTurn({
        prompt: "fix the typo in button label",
        mode: "plan",
        enableGovernance: true,
        governanceRigor: "auto",
      }),
    ).toEqual({ lane: "lean", tier: "surgical", mode: "plan" });
  });

  it("routes a secret-touching prompt to governed spec-first", () => {
    expect(
      routeTurn({
        prompt: "rotate the leaked api key in .env",
        mode: "plan",
        enableGovernance: true,
        governanceRigor: "auto",
      }),
    ).toEqual({ lane: "governed", tier: "surgical", mode: "plan" });
  });

  it("keeps the requested mode through governance routing", () => {
    expect(
      routeTurn({
        prompt: "rotate the leaked api key in .env",
        mode: "local-agent",
        enableGovernance: true,
        governanceRigor: "auto",
      }),
    ).toMatchObject({ lane: "governed", mode: "local-agent" });
  });

  it("applies an explicit rigor override instead of the scored tier", () => {
    expect(
      routeTurn({
        prompt: "fix the typo in button label",
        mode: "plan",
        enableGovernance: true,
        governanceRigor: "architectural",
      }),
    ).toEqual({ lane: "lean", tier: "architectural", mode: "plan" });
  });

  it("routes everything lean when governance is off", () => {
    expect(
      routeTurn({
        prompt: "rotate the leaked api key in .env",
        mode: "plan",
        enableGovernance: false,
        governanceRigor: "auto",
      }),
    ).toEqual({ lane: "lean", tier: "surgical", mode: "plan" });
  });
});
