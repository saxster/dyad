import { describe, it, expect } from "vitest";
import { scoreRigorAxes } from "./rigor_tiers";

describe("scoreRigorAxes", () => {
  it.each([
    {
      name: "auth raises Security Sensitivity",
      prompt: "add authentication to the settings page",
      context: {},
      expected: { breadth: 0, security: 1, novelty: 0, blastRadius: 0 },
    },
    {
      name: "payments raise Security Sensitivity",
      prompt: "wire up payments in the store",
      context: {},
      expected: { breadth: 0, security: 1, novelty: 0, blastRadius: 0 },
    },
    {
      name: "migrations raise Security Sensitivity",
      prompt: "write a migration for the orders table",
      context: {},
      expected: { breadth: 0, security: 1, novelty: 0, blastRadius: 0 },
    },
    {
      name: "distinct security signals accumulate",
      prompt: "add auth, payments billing, and a migration plus a secret token",
      context: {},
      expected: { breadth: 0, security: 3, novelty: 0, blastRadius: 0 },
    },
    {
      name: "rewrite the data layer raises Domain Breadth",
      prompt: "rewrite the data layer",
      context: {},
      expected: { breadth: 2, security: 0, novelty: 0, blastRadius: 0 },
    },
    {
      name: "unfamiliar/new-integration wording raises Novelty",
      prompt: "integrate with an unfamiliar service through a new integration",
      context: {},
      expected: { breadth: 0, security: 0, novelty: 2, blastRadius: 0 },
    },
    {
      name: "touched db and manifest paths raise Blast Radius",
      prompt: "update the schema",
      context: { touchedPaths: ["src/db/schema.ts", "package.json"] },
      expected: { breadth: 0, security: 0, novelty: 0, blastRadius: 2 },
    },
    {
      name: "every axis clamps at 3",
      prompt:
        "add auth payment billing migration secret token; unfamiliar new integration never seen before; rewrite the data layer across the codebase",
      context: {
        touchedPaths: [
          "src/db/schema.ts",
          "migrations/0001_init.sql",
          "package.json",
          "src/db/seed.ts",
          "src/db/index.ts",
        ],
      },
      expected: { breadth: 3, security: 3, novelty: 3, blastRadius: 3 },
    },
    {
      name: "a benign prompt scores zero everywhere",
      prompt: "fix the typo in the button label",
      context: {},
      expected: { breadth: 0, security: 0, novelty: 0, blastRadius: 0 },
    },
  ])("$name", ({ prompt, context, expected }) => {
    expect(scoreRigorAxes(prompt, context)).toEqual(expected);
  });
});
