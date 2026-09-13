import { useState } from "react";

export interface PanelThought {
  id: string;
  body: string;
  tags: string[];
  todoStatus: "none" | "todo" | "done";
}

type ThoughtTab = "all" | "todo" | "tags";

const TABS: ThoughtTab[] = ["all", "todo", "tags"];

export function ThoughtPanel({
  thoughts,
  onSubmit,
  onStartIncubation,
}: {
  thoughts: PanelThought[];
  onSubmit?: (body: string) => void;
  onStartIncubation?: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<ThoughtTab>("all");

  const visible =
    tab === "todo"
      ? thoughts.filter((thought) => thought.todoStatus === "todo")
      : thoughts;
  const tagCounts = new Map<string, number>();
  for (const thought of thoughts) {
    for (const tag of thought.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 p-3 text-sm"
      data-testid="thought-panel"
    >
      <div className="flex gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            data-testid={`thought-tab-${name}`}
            className={
              tab === name ? "font-medium underline" : "text-muted-foreground"
            }
            onClick={() => setTab(name)}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>

      {tab === "tags" ? (
        <ul className="ml-4 list-disc" data-testid="thought-tags">
          {[...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([tag, count]) => (
              <li key={tag}>
                {tag} × {count}
              </li>
            ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {visible.map((thought) => (
            <li
              key={thought.id}
              data-testid={`thought-${thought.id}`}
              className="flex items-center gap-2"
            >
              <span>{thought.body}</span>
              {thought.todoStatus !== "none" ? (
                <span className="text-xs uppercase text-muted-foreground">
                  {thought.todoStatus}
                </span>
              ) : null}
              <button
                type="button"
                data-testid={`thought-promote-${thought.id}`}
                className="ml-auto text-xs text-primary underline"
                onClick={() => onStartIncubation?.(thought.id)}
              >
                Promote to incubation
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        data-testid="thought-input"
        placeholder="Capture a thought…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            const body = draft.trim();
            if (body) {
              onSubmit?.(body);
              setDraft("");
            }
          }
        }}
        className="rounded border p-2 text-xs"
        rows={2}
      />
    </div>
  );
}
