import { useQuery } from "@tanstack/react-query";
import { governanceClient } from "@/ipc/contracts/governance_contracts";
import { queryKeys } from "@/lib/queryKeys";

export function useGovernanceSpecBundle(appId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.governance.specBundle({ appId: appId ?? 0 }),
    queryFn: () => governanceClient.getSpecBundle({ appId: appId as number }),
    enabled: appId != null,
  });

  return {
    bundle: query.data?.bundle ?? null,
    artifactVersion: query.data?.artifactVersion ?? null,
    approvalStatus: query.data?.bundle.approvalStatus ?? null,
    isLoading: query.isLoading,
  };
}
