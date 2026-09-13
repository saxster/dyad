import { expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { Timeout, testSkipIfWindows } from "./helpers/test_helper";

testSkipIfWindows(
  "governed turn end - verification verdict surfaces in chat",
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

    // The verdict is appended to the persisted message after the stream's
    // completion snapshot was taken, so reload the window (in-page, since the
    // file:// URL cannot be re-navigated by Playwright) to re-read the db and
    // surface it.
    await po.page.evaluate(() => location.reload());
    await po.page.waitForLoadState("domcontentloaded");
    await expect(po.page.getByText("Spec verification").first()).toBeVisible({
      timeout: Timeout.LONG,
    });
    await expect(po.page.getByText(/1 green/).first()).toBeVisible({
      timeout: Timeout.MEDIUM,
    });
  },
);
