import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  apps,
  governanceRunEvents,
  governanceRuns,
  messages,
  specBundles,
  specVerifications,
  versions,
} from "@/db/schema";
import { extractContracts } from "@/governance/verification/extract_contracts";
import { runContracts } from "@/governance/verification/contract_runner";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import {
  nextApprovalStatus,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import { governanceContracts } from "../contracts/governance_contracts";
import { getDyadAppPath } from "@/paths/paths";
import { createTypedHandler } from "./base";

async function getArtifactStoreForApp(appId: number): Promise<{
  store: ArtifactStore;
  appPath: string;
}> {
  const app = await db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app) {
    throw new DyadError(`app ${appId} not found`, DyadErrorKind.NotFound);
  }
  const resolvedPath = getDyadAppPath(app.path);
  return { store: new ArtifactStore(resolvedPath), appPath: resolvedPath };
}

export async function appendRunEvent(
  runId: number,
  type: string,
  payload: unknown,
): Promise<{ id: number; runId: number; seq: number; type: string }> {
  const latest = await db
    .select({ seq: governanceRunEvents.seq })
    .from(governanceRunEvents)
    .where(eq(governanceRunEvents.runId, runId))
    .orderBy(desc(governanceRunEvents.seq))
    .get();
  const seq = (latest?.seq ?? 0) + 1;
  const inserted = db
    .insert(governanceRunEvents)
    .values({
      runId,
      seq,
      type,
      payloadJson: JSON.stringify(payload),
    })
    .returning({ id: governanceRunEvents.id })
    .get();
  return { id: inserted.id, runId, seq, type };
}

export interface VerificationStamp {
  verified: boolean;
  criteriaCount: number;
  green: number;
  red: number;
}

export function stampVerification(
  runId: number,
  versionId: number,
): VerificationStamp {
  const probeRows = db
    .select()
    .from(specVerifications)
    .where(
      and(
        eq(specVerifications.runId, runId),
        eq(specVerifications.kind, "probe"),
      ),
    )
    .all();
  const redFirstKeys = probeRows
    .filter((row) => row.status === "probe-red")
    .map((row) => row.criterionKey);

  const checkRows = db
    .select()
    .from(specVerifications)
    .where(
      and(
        eq(specVerifications.runId, runId),
        eq(specVerifications.kind, "check"),
      ),
    )
    .all();
  const checkByKey = new Map(checkRows.map((row) => [row.criterionKey, row]));

  const verified =
    redFirstKeys.length > 0 &&
    redFirstKeys.every((key) => checkByKey.get(key)?.status === "green");

  for (const row of checkRows) {
    db.update(specVerifications)
      .set({ versionId })
      .where(eq(specVerifications.id, row.id))
      .run();
  }

  const green = checkRows.filter((row) => row.status === "green").length;
  const red = checkRows.filter((row) => row.status === "red").length;
  return { verified, criteriaCount: checkRows.length, green, red };
}

export async function runGovernedTurnVerification(options: {
  appId: number;
  chatId: number;
  messageId: number;
}): Promise<void> {
  const { store, appPath } = await getArtifactStoreForApp(options.appId);
  const bundle = await store.loadBundle();
  if (bundle.approvalStatus !== "approved") {
    return;
  }
  const { executable } = extractContracts(bundle);
  const results = await runContracts(executable, { cwd: appPath });

  const runRow = await db
    .select({ id: governanceRuns.id })
    .from(governanceRuns)
    .where(eq(governanceRuns.chatId, options.chatId))
    .orderBy(desc(governanceRuns.id))
    .get();
  if (!runRow) {
    return;
  }

  for (const result of results) {
    db.insert(specVerifications)
      .values({
        runId: runRow.id,
        criterionKey: result.key,
        kind: "check",
        status: result.status,
        exitCode: result.exitCode ?? null,
        outputTail: result.outputTail || null,
      })
      .run();
  }

  const green = results.filter((result) => result.status === "green").length;
  const red = results.length - green;
  await appendRunEvent(runRow.id, "verification_completed", { green, red });

  const message = await db
    .select()
    .from(messages)
    .where(eq(messages.id, options.messageId))
    .get();
  if (message) {
    const allGreen = results.length > 0 && green === results.length;
    db.update(messages)
      .set({
        content: `${message.content}\n<dyad-status title="Spec verification" state="${allGreen ? "finished" : "error"}">${green} green, ${red} red</dyad-status>`,
      })
      .where(eq(messages.id, options.messageId))
      .run();
  }
}

export function registerGovernanceHandlers(): void {
  createTypedHandler(
    governanceContracts.saveSpecBundle,
    async (_event, { appId, bundle }) => {
      const { store } = await getArtifactStoreForApp(appId);
      const stamped = await store.saveBundle(bundle);

      db.insert(specBundles)
        .values({
          appId,
          artifactVersion: stamped.version,
          approvalStatus: stamped.approvalStatus,
          approvedAt: stamped.approvedAt ? new Date(stamped.approvedAt) : null,
        })
        .run();

      return { bundle: stamped, artifactVersion: stamped.version };
    },
  );

  createTypedHandler(
    governanceContracts.listSpecBundleHistory,
    async (_event, { appId }) => {
      const { store } = await getArtifactStoreForApp(appId);
      return store.listHistory();
    },
  );

  createTypedHandler(
    governanceContracts.getSpecBundle,
    async (_event, { appId }) => {
      const { store } = await getArtifactStoreForApp(appId);
      const row = await db
        .select()
        .from(specBundles)
        .where(eq(specBundles.appId, appId))
        .get();
      if (!row) {
        return null;
      }
      let bundle: SpecBundle;
      try {
        bundle = await store.loadBundle();
      } catch {
        return null;
      }
      return { bundle, artifactVersion: row.artifactVersion };
    },
  );

  createTypedHandler(
    governanceContracts.approveSpecBundle,
    async (_event, { appId, decision, feedback }) => {
      const { store } = await getArtifactStoreForApp(appId);
      let current: SpecBundle;
      try {
        current = await store.loadBundle();
      } catch {
        throw new DyadError(
          `no spec bundle saved for app ${appId}`,
          DyadErrorKind.NotFound,
        );
      }

      const approvalEvent =
        decision === "approve"
          ? { type: "approve" as const, approvedAt: new Date().toISOString() }
          : { type: "reject" as const };
      const next = nextApprovalStatus(current.approvalStatus, approvalEvent);
      if ("error" in next) {
        throw new DyadError(next.error, DyadErrorKind.Precondition);
      }

      let updated: SpecBundle = { ...current, approvalStatus: next.status };
      if (decision === "approve") {
        updated = { ...updated, approvedAt: approvalEvent.approvedAt };
      } else {
        updated = {
          ...updated,
          approvedAt: undefined,
          provenance: feedback
            ? { ...current.provenance, lastRejectionFeedback: feedback }
            : current.provenance,
        };
      }

      if (decision === "reject" && feedback) {
        // Return the chat to planning: inject the rejection feedback so the
        // next turn's prepared messages carry it to the model.
        const latestChatRow = await db
          .select({ chatId: specBundles.chatId })
          .from(specBundles)
          .where(
            and(eq(specBundles.appId, appId), isNotNull(specBundles.chatId)),
          )
          .orderBy(desc(specBundles.id))
          .get();
        if (latestChatRow?.chatId) {
          db.insert(messages)
            .values({
              chatId: latestChatRow.chatId,
              role: "user",
              content: `Your spec was rejected. Feedback: ${feedback}\nRevise the spec with write_spec and present it for approval again.`,
            })
            .run();
        }
      }

      const stamped = await store.saveBundle(updated);
      db.insert(specBundles)
        .values({
          appId,
          artifactVersion: stamped.version,
          approvalStatus: stamped.approvalStatus,
          approvedAt: stamped.approvedAt ? new Date(stamped.approvedAt) : null,
        })
        .run();

      return {
        approvalStatus: stamped.approvalStatus,
        approvedAt: stamped.approvedAt ?? null,
      };
    },
  );

  createTypedHandler(
    governanceContracts.getVersionVerification,
    async (_event, { appId, commitHash }) => {
      const versionRow = await db
        .select({ id: versions.id })
        .from(versions)
        .where(
          and(eq(versions.appId, appId), eq(versions.commitHash, commitHash)),
        )
        .orderBy(desc(versions.id))
        .get();
      if (!versionRow) {
        return null;
      }
      const checkRows = await db
        .select()
        .from(specVerifications)
        .where(eq(specVerifications.versionId, versionRow.id))
        .all();
      if (checkRows.length === 0) {
        return null;
      }
      const green = checkRows.filter((row) => row.status === "green").length;
      const red = checkRows.filter((row) => row.status === "red").length;
      return {
        verified: red === 0 && green > 0,
        green,
        red,
        failing: checkRows
          .filter((row) => row.status === "red")
          .map((row) => row.criterionKey),
      };
    },
  );
}
