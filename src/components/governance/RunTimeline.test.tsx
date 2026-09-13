import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunTimeline } from "./RunTimeline";

describe("RunTimeline", () => {
  it("renders node states from a run snapshot", () => {
    render(
      <RunTimeline
        nodes={[
          { id: "node-a", title: "Node A", status: "green" },
          { id: "node-b", title: "Node B", status: "running" },
          { id: "node-c", title: "Node C", status: "red" },
          { id: "node-d", title: "Node D", status: "blocked" },
          { id: "node-e", title: "Node E", status: "pending" },
        ]}
        events={[
          { seq: 1, type: "dag_node_started", at: "2026-09-13T10:00:00Z" },
          { seq: 2, type: "dag_node_completed", at: "2026-09-13T10:05:00Z" },
        ]}
      />,
    );

    for (const [id, status] of [
      ["node-a", "green"],
      ["node-b", "running"],
      ["node-c", "red"],
      ["node-d", "blocked"],
      ["node-e", "pending"],
    ] as const) {
      expect(screen.getByTestId(`run-node-${id}`).textContent).toContain(
        status,
      );
    }
    expect(screen.getByTestId("run-node-node-a").className).toContain(
      "text-green-600",
    );
    expect(screen.getByTestId("run-node-node-c").className).toContain(
      "text-red-600",
    );

    expect(screen.getByTestId("run-events").children).toHaveLength(2);
    expect(screen.getByText(/dag_node_started/)).toBeTruthy();
    expect(screen.getByText(/dag_node_completed/)).toBeTruthy();
  });

  it("renders an empty event list when there are no events", () => {
    render(<RunTimeline nodes={[]} events={[]} />);

    expect(screen.getByTestId("run-events").children).toHaveLength(0);
  });
});
