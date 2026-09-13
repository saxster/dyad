export interface BackendEvent {
  type: "started" | "output" | "completed" | "failed";
  /** Node/task identifier the event belongs to. */
  node?: string;
  text?: string;
  exitCode?: number;
  error?: string;
  /** File reported by a completed event; lets the DAG orchestrator detect cross-node conflicts. */
  file?: string;
}

export interface BackendTask {
  id: string;
  prompt: string;
  cwd: string;
}

export interface GovernedBackend {
  dispatch(task: BackendTask): AsyncIterable<BackendEvent>;
}
