import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export interface RunCommandResult {
  stdout: string;
  exitCode: number;
}

/** Two-arg process runner (command + argv, optional stdin). */
export type RunCommand = (
  cmd: string,
  argv: string[],
  stdin?: string,
) => Promise<RunCommandResult>;

export interface IssueIntent {
  rawIntent: string;
  title: string;
  metadata: {
    source: "github-issue";
    url: string;
    repo: string;
    issueNumber: number;
  };
}

/**
 * Fetches one GitHub issue through the gh CLI and maps it into a raw intent
 * for a governed run. gh failures are surfaced as External errors so they
 * are never mistaken for product bugs.
 */
export async function fetchIssueDetails(
  repo: string,
  issueNumber: number,
  { runCommand }: { runCommand: RunCommand },
): Promise<IssueIntent> {
  const result = await runCommand("gh", [
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    repo,
    "--json",
    "title,body,url",
  ]);
  if (result.exitCode !== 0) {
    throw new DyadError(
      `gh issue view ${issueNumber} in ${repo} failed with exit code ${result.exitCode}`,
      DyadErrorKind.External,
    );
  }
  const issue = JSON.parse(result.stdout) as {
    title: string;
    body: string;
    url: string;
  };
  return {
    rawIntent: `${issue.title}\n\n${issue.body}`,
    title: issue.title,
    metadata: {
      source: "github-issue",
      url: issue.url,
      repo,
      issueNumber,
    },
  };
}

export interface AutopilotDeps {
  runCommand: RunCommand;
  fetchIssue: (
    repo: string,
    issueNumber: number,
    deps: { runCommand: RunCommand },
  ) => Promise<IssueIntent>;
  executeRun: (input: {
    repo: string;
    issueNumber: number;
    rawIntent: string;
    branch: string;
  }) => Promise<void>;
}

/**
 * Autopilot: issue → branch → governed run → commit → push → draft PR. A
 * failed governed run still ships the branch, with the PR body carrying a
 * verification report of the failure instead of silently dying.
 */
export async function autopilotRun(
  { repo, issueNumber }: { repo: string; issueNumber: number },
  deps: AutopilotDeps,
): Promise<void> {
  const issue = await deps.fetchIssue(repo, issueNumber, deps);

  const branch = `auto/issue-${issueNumber}`;
  await deps.runCommand("git", ["checkout", "-b", branch]);

  let failureMessage: string | undefined;
  try {
    await deps.executeRun({
      repo,
      issueNumber,
      rawIntent: issue.rawIntent,
      branch,
    });
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error);
  }

  await deps.runCommand("git", ["add", "-A"]);
  await deps.runCommand("git", [
    "commit",
    "-m",
    `fix(issue ${issueNumber}): ${issue.title}`,
  ]);
  await deps.runCommand("git", ["push", "-u", "origin", "HEAD"]);

  const body =
    failureMessage !== undefined
      ? `Fixes #${issueNumber}\n\n## Verification report\n\nThe governed run failed:\n\n${failureMessage}`
      : `Fixes #${issueNumber}\n\n${issue.rawIntent}`;
  await deps.runCommand(
    "gh",
    [
      "pr",
      "create",
      "--draft",
      "--title",
      `Issue #${issueNumber}: ${issue.title}`,
      "--body-file",
      "-",
    ],
    body,
  );
}
