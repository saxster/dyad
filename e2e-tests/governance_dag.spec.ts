import { expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Timeout, testSkipIfWindows } from "./helpers/test_helper";

// The po fixture is auto, so the packaged app launches before the test body
// runs: the fake-backend flag must be set at module load to land in the
// launched app's environment. Deleted after this file's tests so the flag
// cannot leak to a later spec in the same Playwright worker.
process.env.DYAD_GOVERNANCE_FAKE_BACKEND = "1";

const TASK_NODE_A = {
  id: "node-a",
  title: "Node A",
  description: "",
  estimatedPhase: "",
  status: "",
  requiresTestFirst: false,
  dependsOnTitles: [],
  linkedComponentIds: [],
  linkedCriterionIds: [],
  linkedStoryIds: [],
};

const TASK_NODE_B = {
  id: "node-b",
  title: "Node B",
  description: "",
  estimatedPhase: "",
  status: "",
  requiresTestFirst: false,
  dependsOnTitles: ["Node A"],
  linkedComponentIds: [],
  linkedCriterionIds: [],
  linkedStoryIds: [],
};

testSkipIfWindows(
  "governed DAG run - a 2-node task manifest executes through the fake backend",
  async ({ po }) => {
    await po.setUpDyadPro({ localAgent: true });
    await po.importApp("minimal");
    await po.chatActions.clickNewChat();
    await po.chatActions.selectChatMode("plan");

    // The fake model submits the governed spec via the write_spec tool.
    await po.sendPrompt("tc=local-agent/governance-verify-flow");

    const panel = po.page.getByTestId("spec-review-panel");
    await expect(panel).toBeVisible({ timeout: Timeout.LONG });
    await panel.getByRole("button", { name: "Approve" }).click();
    await expect(panel).toContainText("approved", { timeout: Timeout.MEDIUM });

    // write_spec cannot carry manifest tasks (stories-only schema), so seed
    // them on disk once the approval flow has persisted the approved bundle.
    const appDir = po.appManagement.getAppPath({ appName: "minimal" });
    const bundlePath = join(appDir, ".dyad", "specs", "bundle.json");
    await mkdir(dirname(bundlePath), { recursive: true });
    await expect(async () => {
      const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
      bundle.manifest.tasks = [TASK_NODE_A, TASK_NODE_B];
      await writeFile(bundlePath, JSON.stringify(bundle, null, 2));
    }).toPass({ timeout: Timeout.MEDIUM });

    await po.chatActions.selectChatMode("local-agent");
    await po.sendPrompt("rotate the leaked api key in .env");

    // The DAG fast path replaces the model stream for this turn.
    await expect(
      po.page.getByText("DAG completed: node-a, node-b"),
    ).toBeVisible({ timeout: Timeout.LONG });

    // Persisted proof: the dag_* lifecycle events landed on the governance
    // run, and the final assistant message carries the completion line.
    const userDataDir = dirname(dirname(appDir));
    const db = new DatabaseSync(join(userDataDir, "sqlite.db"), {
      readOnly: true,
    });
    await expect(async () => {
      const events = db
        .prepare(
          "SELECT COUNT(*) AS n FROM governance_run_events WHERE type LIKE 'dag_node_%'",
        )
        .get();
      expect(Number(events?.n)).toBeGreaterThanOrEqual(4);
      const message = db
        .prepare(
          "SELECT content FROM messages WHERE role = 'assistant' ORDER BY id DESC LIMIT 1",
        )
        .get();
      expect(message?.content).toContain("DAG completed: node-a, node-b");
    }).toPass({ timeout: Timeout.MEDIUM });
    db.close();
  },
);
