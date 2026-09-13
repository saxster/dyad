import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import {
  parseSpecBundle,
  serializeSpecBundle,
  SpecBundleSchema,
  type SpecBundle,
} from "../core/spec_bundle_schemas";
import { renderRequirementsMarkdown } from "../core/requirements_markdown";
import { extractContracts } from "../verification/extract_contracts";
import { isSafeVerificationCommand } from "../verification/contract_runner";

export interface BundleHistoryEntry {
  version: number;
  bundle: SpecBundle;
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, contents);
  await rename(tmpPath, filePath);
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface ExportedScript {
  argv: string[];
  scriptRelativePath: string;
  criterionKey: string;
  verificationContract: string;
}

export interface SkippedTask {
  criterionKey: string;
  reason: string;
}

export async function exportVerificationScripts(
  root: string,
  bundle: SpecBundle,
): Promise<void> {
  const binDir = join(root, ".dyad", "bin");
  await mkdir(binDir, { recursive: true });

  const { executable, manual } = extractContracts(bundle);
  const exportedScripts: ExportedScript[] = [];
  const skippedTasks: SkippedTask[] = [];

  for (const contract of executable) {
    if (!isSafeVerificationCommand(contract.command)) {
      skippedTasks.push({
        criterionKey: contract.key,
        reason: "unsafe command",
      });
      continue;
    }
    const argv = contract.command.split(/\s+/);
    const scriptRelativePath = `.dyad/bin/verify-${contract.key.replace(/\//g, "-")}.sh`;
    const script = [
      "#!/bin/bash",
      "set -euo pipefail",
      "",
      `cd ${shQuote(root)}`,
      "command=(",
      ...argv.map((arg) => `  ${shQuote(arg)}`),
      ")",
      "",
      '"${command[@]}"',
      "",
    ].join("\n");
    await atomicWrite(join(root, scriptRelativePath), script);
    exportedScripts.push({
      argv,
      scriptRelativePath,
      criterionKey: contract.key,
      verificationContract: contract.command,
    });
  }
  for (const criterion of manual) {
    skippedTasks.push({
      criterionKey: criterion.key,
      reason: "no verification contract",
    });
  }

  await atomicWrite(
    join(binDir, "verification-tasks.json"),
    JSON.stringify(
      {
        binDirectoryRelativePath: ".dyad/bin",
        exportedScripts,
        skippedTasks,
      },
      null,
      2,
    ),
  );

  const readme = [
    "# Verification tasks",
    "",
    "## Scripts",
    ...exportedScripts.map(
      (script) =>
        `- \`${script.scriptRelativePath}\` — \`${script.criterionKey}\`: \`${script.verificationContract}\``,
    ),
    "",
    "## Skipped",
    ...skippedTasks.map((task) => `- \`${task.criterionKey}\`: ${task.reason}`),
    "",
  ].join("\n");
  await atomicWrite(join(binDir, "README.md"), readme);
}

export class ArtifactStore {
  constructor(readonly root: string) {}

  private get specsDir(): string {
    return join(this.root, ".dyad", "specs");
  }

  private get historyDir(): string {
    return join(this.specsDir, "history");
  }

  private get bundlePath(): string {
    return join(this.specsDir, "bundle.json");
  }

  private get requirementsPath(): string {
    return join(this.specsDir, "requirements.md");
  }

  async saveBundle(bundle: SpecBundle): Promise<SpecBundle> {
    const parsed = SpecBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      throw new DyadError(
        `invalid spec bundle: ${parsed.error.message}`,
        DyadErrorKind.Validation,
      );
    }

    const version = (await this.currentMaxVersion()) + 1;
    const stamped: SpecBundle = { ...bundle, version };

    await mkdir(this.historyDir, { recursive: true });
    const historyPath = join(this.historyDir, `${version}-${stamped.id}.json`);
    await atomicWrite(historyPath, serializeSpecBundle(stamped));
    await atomicWrite(this.bundlePath, serializeSpecBundle(stamped));
    await atomicWrite(
      this.requirementsPath,
      renderRequirementsMarkdown(stamped),
    );
    return stamped;
  }

  async loadBundle(): Promise<SpecBundle> {
    const raw = await readFile(this.bundlePath, "utf8");
    return parseSpecBundle(raw);
  }

  async listHistory(): Promise<BundleHistoryEntry[]> {
    let files: string[];
    try {
      files = await readdir(this.historyDir);
    } catch {
      return [];
    }
    const entries = await Promise.all(
      files
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => {
          const raw = await readFile(join(this.historyDir, name), "utf8");
          return {
            version: Number(name.split("-")[0]),
            bundle: parseSpecBundle(raw),
          };
        }),
    );
    return entries.sort((a, b) => a.version - b.version);
  }

  private async currentMaxVersion(): Promise<number> {
    const history = await this.listHistory();
    return history.length > 0 ? history[history.length - 1].version : 0;
  }
}
