import { expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Timeout, testSkipIfWindows } from "./helpers/test_helper";

testSkipIfWindows(
  "governed turn end - verification verdict is persisted for the turn",
  async ({ po }) => {
    await po.setUpDyadPro({ localAgent: true });
    await po.importApp("minimal");
    await po.chatActions.clickNewChat();
    await po.chatActions.selectChatMode("plan");

    // The fake model submits the governed spec (with a runnable contract)
    // via the write_spec tool.
    await po.sendPrompt("tc=local-agent/governance-verify-flow");

    const panel = po.page.getByTestId("spec-review-panel");
    await expect(panel).toBeVisible({ timeout: Timeout.LONG });
    await panel.getByRole("button", { name: "Approve" }).click();
    await expect(panel).toContainText("approved", { timeout: Timeout.MEDIUM });

    // A governed agent-mode turn runs against app state the contract can
    // check. The fake model's response arrives as text (it cannot execute a
    // real write in this flow), so seed the app state the contract verifies.
    const appDir = po.appManagement.getAppPath({ appName: "minimal" });
    await mkdir(appDir, { recursive: true });
    await writeFile(`${appDir}/file1.txt`, "governed turn output\n");
    await po.chatActions.selectChatMode("local-agent");
    await po.sendPrompt("rotate the leaked api key in .env");

    // The governed turn completed: the approval gate did not refuse it and
    // the file the contract checks renders in the chat.
    await expect(po.page.getByText(/still needs approval/)).toBeHidden({
      timeout: Timeout.MEDIUM,
    });
    await expect(po.page.getByText("file1.txt").first()).toBeVisible({
      timeout: Timeout.MEDIUM,
    });

    // The turn-end verification verdict is persisted: a green check row for
    // the contract, a verification_completed run event, and the verdict
    // appended to the final assistant message. (Surfacing it live in the open
    // chat needs a renderer message-refresh mechanism — tracked separately.)
    const userDataDir = dirname(dirname(appDir));
    const db = new DatabaseSync(join(userDataDir, "sqlite.db"), {
      readOnly: true,
    });
    await expect(async () => {
      const check = db
        .prepare(
          "SELECT status, exit_code FROM spec_verifications WHERE kind = 'check' AND criterion_key = 'US-1/AC-1'",
        )
        .get();
      expect(check).toEqual({ status: "green", exit_code: 0 });

      const events = db
        .prepare(
          "SELECT COUNT(*) AS n FROM governance_run_events WHERE type = 'verification_completed'",
        )
        .get();
      expect(events?.n).toBeGreaterThanOrEqual(1);

      const message = db
        .prepare(
          "SELECT content FROM messages WHERE role = 'assistant' ORDER BY id DESC LIMIT 1",
        )
        .get();
      expect(message?.content).toContain("Spec verification");
      expect(message?.content).toContain("1 green, 0 red");
    }).toPass({ timeout: Timeout.MEDIUM });
    db.close();
  },
);
