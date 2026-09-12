import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, specBundles } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import {
  nextApprovalStatus,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import { governanceContracts } from "../contracts/governance_contracts";
import { createTypedHandler } from "./base";

async function getArtifactStoreForApp(appId: number): Promise<{
  store: ArtifactStore;
  appPath: string;
}> {
  const app = await db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app) {
    throw new DyadError(`app ${appId} not found`, DyadErrorKind.NotFound);
  }
  return { store: new ArtifactStore(app.path), appPath: app.path };
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
}
