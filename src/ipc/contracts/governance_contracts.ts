import { z } from "zod";
import { defineContract, createClient } from "./core";
import { SpecBundleSchema } from "../../governance/core/spec_bundle_schemas";

export const governanceContracts = {
  saveSpecBundle: defineContract({
    channel: "governance:save-spec-bundle",
    input: z.object({
      appId: z.number(),
      bundle: SpecBundleSchema,
    }),
    output: z.object({
      bundle: SpecBundleSchema,
      artifactVersion: z.number(),
    }),
  }),

  getSpecBundle: defineContract({
    channel: "governance:get-spec-bundle",
    input: z.object({ appId: z.number() }),
    output: z
      .object({
        bundle: SpecBundleSchema,
        artifactVersion: z.number(),
      })
      .nullable(),
  }),

  listSpecBundleHistory: defineContract({
    channel: "governance:list-spec-bundle-history",
    input: z.object({ appId: z.number() }),
    output: z.array(
      z.object({
        version: z.number(),
        bundle: SpecBundleSchema,
      }),
    ),
  }),

  approveSpecBundle: defineContract({
    channel: "governance:approve-spec-bundle",
    input: z.object({
      appId: z.number(),
      decision: z.enum(["approve", "reject"]),
      feedback: z.string().optional(),
    }),
    output: z.object({
      approvalStatus: z.enum(["draft", "pending_approval", "approved"]),
      approvedAt: z.string().nullable(),
    }),
  }),

  getGovernanceRun: defineContract({
    channel: "governance:get-run",
    input: z.object({ runId: z.number() }),
    output: z.object({
      id: z.number(),
      appId: z.number(),
      chatId: z.number().nullable(),
      bundleId: z.number().nullable(),
      lane: z.string(),
      tier: z.string(),
      status: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      events: z.array(
        z.object({
          seq: z.number(),
          type: z.string(),
          payload: z.unknown(),
          at: z.string(),
        }),
      ),
    }),
  }),
  getVersionVerification: defineContract({
    channel: "governance:get-version-verification",
    input: z.object({ appId: z.number(), commitHash: z.string() }),
    output: z
      .object({
        verified: z.boolean(),
        green: z.number(),
        red: z.number(),
        failing: z.array(z.string()),
      })
      .nullable(),
  }),
} as const;

export const governanceClient = createClient(governanceContracts);

export type SaveSpecBundleOutput = z.infer<
  (typeof governanceContracts)["saveSpecBundle"]["output"]
>;
export type GetSpecBundleOutput = z.infer<
  (typeof governanceContracts)["getSpecBundle"]["output"]
>;
export type ApproveSpecBundleOutput = z.infer<
  (typeof governanceContracts)["approveSpecBundle"]["output"]
>;
export type GetGovernanceRunOutput = z.infer<
  (typeof governanceContracts)["getGovernanceRun"]["output"]
>;
