import { describe, expect, it } from "vitest";
import { detectConstellations } from "./constellations";

const t = (id: string, tags: string[]) => ({ id, tags });

describe("detectConstellations", () => {
  it("finds one constellation when every pair shares the minimum tags", () => {
    expect(
      detectConstellations([
        t("A", ["a", "b", "c"]),
        t("B", ["a", "b", "d"]),
        t("C", ["a", "b", "e"]),
      ]),
    ).toEqual([{ thoughtIds: ["A", "B", "C"], dominantTags: ["a", "b"] }]);
  });

  it("excludes thoughts that fail the pair rule against any member", () => {
    expect(
      detectConstellations([
        t("A", ["a", "b", "c"]),
        t("B", ["a", "b", "d"]),
        t("C", ["a", "b", "e"]),
        t("D", ["x", "y"]),
      ]),
    ).toEqual([{ thoughtIds: ["A", "B", "C"], dominantTags: ["a", "b"] }]);
  });

  it("returns no constellation below minSize", () => {
    expect(
      detectConstellations([t("A", ["a", "b"]), t("B", ["a", "b"])]),
    ).toEqual([]);
  });

  it("drops members whose pairwise share falls below minSharedTags", () => {
    expect(
      detectConstellations([
        t("A", ["a", "b"]),
        t("B", ["a", "b"]),
        t("C", ["a", "b"]),
        t("D", ["a"]),
      ]),
    ).toEqual([{ thoughtIds: ["A", "B", "C"], dominantTags: ["a", "b"] }]);
  });
});
