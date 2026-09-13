import { describe, expect, it, vi } from "vitest";
import { autopilotRun, fetchIssueDetails } from "./issue_intake";
import { DyadErrorKind } from "@/errors/dyad_error";

type Recording = { cmd: string; argv: string[]; stdin?: string };

function recordingRunCommand() {
  const calls: Recording[] = [];
  const runCommand = vi.fn(
    async (cmd: string, argv: string[], stdin?: string) => {
      calls.push({ cmd, argv, stdin });
      return { stdout: "", exitCode: 0 };
    },
  );
  return { calls, runCommand };
}

describe("fetchIssueDetails", () => {
  it("fetches the issue via gh and maps it to an intent", async () => {
    const runCommand = vi.fn(async () => ({
      stdout: JSON.stringify({ title: "T", body: "B", url: "U" }),
      exitCode: 0,
    }));

    const intent = await fetchIssueDetails("acme/app", 7, { runCommand });

    expect(intent.rawIntent).toBe("T\n\nB");
    expect(intent.metadata).toEqual({
      source: "github-issue",
      url: "U",
      repo: "acme/app",
      issueNumber: 7,
    });
    expect(runCommand).toHaveBeenCalledWith("gh", [
      "issue",
      "view",
      "7",
      "--repo",
      "acme/app",
      "--json",
      "title,body,url",
    ]);
  });

  it("throws External when gh exits nonzero", async () => {
    const runCommand = vi.fn(async () => ({ stdout: "", exitCode: 1 }));

    await expect(
      fetchIssueDetails("acme/app", 7, { runCommand }),
    ).rejects.toThrow(
      expect.objectContaining({ kind: DyadErrorKind.External }),
    );
  });
});

describe("autopilotRun", () => {
  function issueDeps(options: { failRun?: boolean } = {}) {
    const { calls, runCommand } = recordingRunCommand();
    const fetchIssue = vi.fn(async () => ({
      rawIntent: "Broken login\n\nUsers cannot sign in.",
      title: "Broken login",
      metadata: {
        source: "github-issue" as const,
        url: "U",
        repo: "acme/app",
        issueNumber: 7,
      },
    }));
    const executeRun = vi.fn(async () => {
      if (options.failRun) {
        throw new Error("verification failed");
      }
    });
    return { calls, deps: { runCommand, fetchIssue, executeRun } };
  }

  it("turns an issue into a branch, governed run, and draft PR", async () => {
    const { calls, deps } = issueDeps();

    await autopilotRun({ repo: "acme/app", issueNumber: 7 }, deps);

    const git = (subcommand: string) =>
      calls.find((call) => call.cmd === "git" && call.argv[0] === subcommand);
    expect(git("checkout")?.argv).toEqual(["checkout", "-b", "auto/issue-7"]);
    expect(git("add")?.argv).toEqual(["add", "-A"]);
    expect(git("commit")?.argv).toEqual([
      "commit",
      "-m",
      "fix(issue 7): Broken login",
    ]);
    expect(git("push")?.argv).toEqual(["push", "-u", "origin", "HEAD"]);

    const pr = calls.find((call) => call.cmd === "gh");
    expect(pr?.argv).toEqual([
      "pr",
      "create",
      "--draft",
      "--title",
      "Issue #7: Broken login",
      "--body-file",
      "-",
    ]);
    expect(pr?.stdin).toContain("Broken login");
    expect(deps.executeRun).toHaveBeenCalledTimes(1);
  });

  it("still opens the draft PR with a verification report on failure", async () => {
    const { calls, deps } = issueDeps({ failRun: true });

    await autopilotRun({ repo: "acme/app", issueNumber: 7 }, deps);

    const pr = calls.find((call) => call.cmd === "gh");
    expect(pr?.stdin).toContain("Verification report");
    expect(pr?.stdin).toContain("verification failed");
    expect(calls.find((call) => call.argv[0] === "push")).toBeTruthy();
  });
});
