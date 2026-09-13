import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runContracts } from "./contract_runner";
import type { VerificationContract } from "./extract_contracts";

let cwd: string;

async function writeScript(name: string, body: string): Promise<void> {
  const file = path.join(cwd, name);
  await fs.writeFile(file, body, { mode: 0o755 });
}

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "contract-runner-"));
  await writeScript("pass.sh", "#!/bin/sh\nexit 0\n");
  await writeScript("fail.sh", "#!/bin/sh\nexit 3\n");
  await writeScript("slow.sh", "#!/bin/sh\nsleep 5\n");
  await writeScript(
    "noisy.sh",
    `#!/bin/sh\nnode -e "process.stdout.write('x'.repeat(6000))"\nexit 0\n`,
  );
});

afterEach(async () => {
  await fs.rm(cwd, { recursive: true, force: true });
});

describe("runContracts", () => {
  it("runs a passing command to green and a failing one to red with output tail", async () => {
    const contracts: VerificationContract[] = [
      { key: "US-1/AC-1", command: "sh pass.sh" },
      { key: "US-1/AC-2", command: "sh fail.sh" },
    ];

    const results = await runContracts(contracts, { cwd });

    expect(results).toHaveLength(2);
    expect(results[0].key).toBe("US-1/AC-1");
    expect(results[0].status).toBe("green");
    expect(results[0].exitCode).toBe(0);
    expect(results[0].outputTail).toBe("");
    expect(results[0].durationMs).toEqual(expect.any(Number));
    expect(results[1].key).toBe("US-1/AC-2");
    expect(results[1].status).toBe("red");
    expect(results[1].exitCode).toBe(3);
    expect(results[1].outputTail).toBe("");
    expect(results[1].durationMs).toEqual(expect.any(Number));
  });

  it("enforces a timeout", async () => {
    const startedAt = Date.now();

    const [result] = await runContracts(
      [{ key: "US-1/AC-1", command: "sh slow.sh" }],
      { cwd, timeoutMs: 100 },
    );

    const wallClockMs = Date.now() - startedAt;
    expect(result.status).toBe("timeout");
    expect(result.exitCode).toBeUndefined();
    expect(wallClockMs).toBeLessThan(3000);
  });

  it("caps the output tail at 4000 chars", async () => {
    const [result] = await runContracts(
      [{ key: "US-1/AC-1", command: "sh noisy.sh" }],
      { cwd },
    );

    expect(result.outputTail.length).toBe(4000);
    expect(result.outputTail.endsWith("x")).toBe(true);
  });
});
