export interface RunTimelineNode {
  id: string;
  title?: string;
  status: "pending" | "running" | "green" | "red" | "blocked";
}

export interface RunTimelineEvent {
  seq: number;
  type: string;
  at: string;
}

const RUN_NODE_STATUS_CLASS: Record<RunTimelineNode["status"], string> = {
  pending: "text-muted-foreground",
  running: "text-blue-600",
  green: "text-green-600",
  red: "text-red-600",
  blocked: "text-yellow-600",
};

export function RunTimeline({
  nodes,
  events,
}: {
  nodes: RunTimelineNode[];
  events: RunTimelineEvent[];
}) {
  return (
    <div className="flex flex-col gap-2 p-3 text-sm" data-testid="run-timeline">
      <h3 className="font-medium">Run timeline</h3>
      <ul className="flex flex-col gap-1">
        {nodes.map((node) => (
          <li
            key={node.id}
            data-testid={`run-node-${node.id}`}
            className={RUN_NODE_STATUS_CLASS[node.status]}
          >
            {node.title ?? node.id}: {node.status}
          </li>
        ))}
      </ul>
      <ul
        className="ml-4 list-disc text-xs text-muted-foreground"
        data-testid="run-events"
      >
        {events.map((event) => (
          <li key={event.seq}>
            {event.seq} · {event.type} · {event.at}
          </li>
        ))}
      </ul>
    </div>
  );
}
