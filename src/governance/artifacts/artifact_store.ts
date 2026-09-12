import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseSpecBundle,
  serializeSpecBundle,
  type SpecBundle,
} from "../core/spec_bundle_schemas";

export class ArtifactStore {
  constructor(readonly root: string) {}

  private get specsDir(): string {
    return join(this.root, ".dyad", "specs");
  }

  private get bundlePath(): string {
    return join(this.specsDir, "bundle.json");
  }

  async saveBundle(bundle: SpecBundle): Promise<void> {
    await mkdir(this.specsDir, { recursive: true });
    const tmpPath = `${this.bundlePath}.tmp`;
    await writeFile(tmpPath, serializeSpecBundle(bundle));
    await rename(tmpPath, this.bundlePath);
  }

  async loadBundle(): Promise<SpecBundle> {
    const raw = await readFile(this.bundlePath, "utf8");
    return parseSpecBundle(raw);
  }
}
