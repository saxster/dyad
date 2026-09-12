import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseSpecBundle,
  serializeSpecBundle,
  type SpecBundle,
} from "../core/spec_bundle_schemas";

export interface BundleHistoryEntry {
  version: number;
  bundle: SpecBundle;
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

  async saveBundle(bundle: SpecBundle): Promise<SpecBundle> {
    const version = (await this.currentMaxVersion()) + 1;
    const stamped: SpecBundle = { ...bundle, version };

    await mkdir(this.historyDir, { recursive: true });
    const historyPath = join(this.historyDir, `${version}-${stamped.id}.json`);
    await this.atomicWrite(historyPath, serializeSpecBundle(stamped));
    await this.atomicWrite(this.bundlePath, serializeSpecBundle(stamped));
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

  private async atomicWrite(filePath: string, contents: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, contents);
    await rename(tmpPath, filePath);
  }
}
