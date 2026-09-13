import { describe, it, expect } from "vitest";
import { extractContracts } from "./extract_contracts";
import type { UserStory } from "../core/spec_bundle_schemas";

describe("extractContracts", () => {
  it("flattens a bundle into criterion-keyed contracts", () => {
    const stories: UserStory[] = [
      {
        id: "US-1",
        title: "First story",
        narrative: "As a user I want X So that Y",
        criteria: [
          {
            id: "AC-1",
            given: "the app is built",
            when: "the test suite runs",
            then: "it passes",
            verificationContract: "npm test -- foo",
          },
          {
            id: "AC-2",
            given: "the app dir exists",
            when: "the manifest is checked",
            then: "it is present",
            verificationContract: "test -f package.json",
          },
          {
            id: "AC-3",
            given: "the design is open",
            when: "a reviewer reads it",
            then: "it looks right",
          },
        ],
      },
      {
        id: "US-2",
        title: "Second story",
        narrative: "As a user I want Z So that W",
        criteria: [
          {
            id: "AC-1",
            given: "the panel is open",
            when: "a human inspects it",
            then: "it renders",
          },
        ],
      },
    ];

    expect(extractContracts({ stories } as any)).toEqual({
      executable: [
        { key: "US-1/AC-1", command: "npm test -- foo" },
        { key: "US-1/AC-2", command: "test -f package.json" },
      ],
      manual: [{ key: "US-1/AC-3" }, { key: "US-2/AC-1" }],
    });
  });
});
