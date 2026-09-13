import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RunTimeline } from "@/components/governance/RunTimeline";
import { diffBundles, renderSpecDiff } from "@/governance/core/spec_diff";
import { useGovernanceSpecBundle } from "@/hooks/use_governance";
import { useSettings } from "@/hooks/useSettings";
import { governanceClient } from "@/ipc/contracts/governance_contracts";
import { queryKeys } from "@/lib/queryKeys";

export function SpecReviewPanel({ appId }: { appId: number }) {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const { bundle, artifactVersion, approvalStatus } =
    useGovernanceSpecBundle(appId);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  const historyQuery = useQuery({
    queryKey: queryKeys.governance.specHistory({ appId }),
    queryFn: () => governanceClient.listSpecBundleHistory({ appId }),
  });

  // Hooks stay above the early returns; the timeline only mounts when the
  // app has a governance run to show. Node-status derivation is deferred
  // wiring — the timeline renders the event stream for now.
  const latestRunQuery = useQuery({
    queryKey: queryKeys.governance.latestRun({ appId }),
    queryFn: () => governanceClient.getLatestGovernanceRun({ appId }),
  });
  const latestRun = latestRunQuery.data ?? null;
  const runQuery = useQuery({
    queryKey: queryKeys.governance.run({ runId: latestRun?.id ?? null }),
    queryFn: () => governanceClient.getGovernanceRun({ runId: latestRun!.id }),
    enabled: latestRun !== null,
  });

  if (settings?.enableGovernance === false) {
    return null;
  }

  if (!bundle) {
    return null;
  }

  const history = historyQuery.data ?? [];
  const diff =
    history.length >= 2
      ? renderSpecDiff(
          diffBundles(
            history[history.length - 2].bundle,
            history[history.length - 1].bundle,
          ),
        )
      : null;

  const decide = async (decision: "approve" | "reject") => {
    setPending(true);
    try {
      await governanceClient.approveSpecBundle({
        appId,
        decision,
        ...(decision === "reject" && feedback ? { feedback } : {}),
      });
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: queryKeys.governance.all });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 text-sm"
      data-testid="spec-review-panel"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          Spec review (artifact version {artifactVersion})
        </h3>
        <span className="text-xs uppercase text-muted-foreground">
          {approvalStatus}
        </span>
      </div>

      {diff ? (
        <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
          {diff}
        </pre>
      ) : null}

      <div className="flex flex-col gap-3">
        {bundle.stories.map((story) => (
          <div key={story.id}>
            <div className="font-medium">
              {story.id}: {story.title}
              {story.priority ? ` [${story.priority}]` : ""}
            </div>
            <div className="text-muted-foreground">{story.narrative}</div>
            <ul className="ml-4 list-disc">
              {story.criteria.map((criterion) => (
                <li key={criterion.id}>
                  Given {criterion.given}, when {criterion.when}, then{" "}
                  {criterion.then}
                  {criterion.verificationContract ? (
                    <span className="ml-1">
                      VERIFY <code>{criterion.verificationContract}</code>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <textarea
        placeholder="Feedback for the model"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        className="rounded border p-2 text-xs"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => decide("approve")}
          aria-label="Approve"
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide("reject")}
          aria-label="Reject"
        >
          Reject
        </Button>
      </div>

      {latestRun ? (
        <RunTimeline
          nodes={[]}
          events={(runQuery.data?.events ?? []).map(({ seq, type, at }) => ({
            seq,
            type,
            at,
          }))}
        />
      ) : null}
    </div>
  );
}
