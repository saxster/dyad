import { db } from "@/db";
import { specVerifications } from "@/db/schema";
import {
  runContracts,
  type ContractResult,
  type RunCommandFn,
} from "./contract_runner";
import type { VerificationContract } from "./extract_contracts";

export interface RedFirstResult {
  key: string;
  redFirst: boolean;
  status: ContractResult["status"];
}

export async function probeRedFirst(
  contracts: VerificationContract[],
  options: { cwd: string; timeoutMs?: number; runCommand?: RunCommandFn },
): Promise<RedFirstResult[]> {
  const results = await runContracts(contracts, options);
  return results.map((result) => ({
    key: result.key,
    // A timeout before implementation counts as red (the command cannot yet
    // prove anything), so only green marks the criterion unproven.
    redFirst: result.status !== "green",
    status: result.status,
  }));
}

export function recordProbe(runId: number, results: RedFirstResult[]): void {
  for (const result of results) {
    db.insert(specVerifications)
      .values({
        runId,
        criterionKey: result.key,
        kind: "probe",
        status: result.redFirst ? "probe-red" : "probe-green",
      })
      .run();
  }
}
