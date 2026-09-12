import { expect } from "@playwright/test";
import { Timeout, testSkipIfWindows } from "./helpers/test_helper";

testSkipIfWindows(
  "governed plan mode - writes spec, approve, then a governed turn runs",
  async ({ po }) => {
    await po.setUpDyadPro({ localAgent: true });
    await po.importApp("minimal");
    await po.chatActions.clickNewChat();
    await po.chatActions.selectChatMode("plan");

    // The fake model submits the governed spec via the write_spec tool.
    po.page.on("console", (msg) => {
      console.log("RENDERER_CONSOLE:", msg.type(), msg.text().slice(0, 300));
    });
    po.page.on("pageerror", (err) => {
      console.log("RENDERER_PAGEERROR:", String(err).slice(0, 300));
    });
    await po.sendPrompt("tc=local-agent/governance-write-spec");

    // The governed spec review panel surfaces with the pending spec.
    const panel = po.page.getByTestId("spec-review-panel");
    await expect(panel).toBeVisible({ timeout: Timeout.LONG });
    await expect(panel).toContainText("US-1");
    await expect(panel).toContainText("pending_approval");

    // Approve the spec through the review panel.
    await panel.getByRole("button", { name: "Approve" }).click();
    await expect(panel).toContainText("approved", { timeout: Timeout.MEDIUM });

    // A governed-lane turn now runs instead of being refused by the
    // approval gate.
    await po.sendPrompt("rotate the leaked api key in .env");
    await expect(po.page.getByText(/still needs approval/)).toBeHidden({
      timeout: Timeout.MEDIUM,
    });
  },
);
