import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, specBundles } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { ArtifactStore } from "@/governance/artifacts/artifact_store";
import type { SpecBundle } from "@/governance/core/spec_bundle_schemas";
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
}
