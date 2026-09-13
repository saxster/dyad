import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThoughtPanel, type PanelThought } from "./ThoughtPanel";

const thoughts: PanelThought[] = [
  { id: "t1", body: "todo thought", tags: ["perf"], todoStatus: "todo" },
  { id: "t2", body: "fresh thought", tags: ["dx"], todoStatus: "none" },
  { id: "t3", body: "another todo", tags: ["perf"], todoStatus: "todo" },
];

describe("ThoughtPanel", () => {
  it("renders thoughts and submits on Cmd/Ctrl+Enter", () => {
    const onSubmit = vi.fn();
    render(<ThoughtPanel thoughts={[...thoughts]} onSubmit={onSubmit} />);

    expect(screen.getByTestId("thought-panel")).toBeTruthy();
    for (const thought of thoughts) {
      expect(screen.getByTestId(`thought-${thought.id}`).textContent).toContain(
        thought.body,
      );
    }

    const input = screen.getByPlaceholderText(
      "Capture a thought…",
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "a fresh capture" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith("a fresh capture");
  });

  it("filters the list with the Todo tab", () => {
    render(<ThoughtPanel thoughts={[...thoughts]} />);

    fireEvent.click(screen.getByTestId("thought-tab-todo"));
    expect(screen.getByTestId("thought-t1")).toBeTruthy();
    expect(screen.queryByTestId("thought-t2")).toBeNull();
    expect(screen.getByTestId("thought-t3")).toBeTruthy();

    fireEvent.click(screen.getByTestId("thought-tab-all"));
    expect(screen.queryByTestId("thought-t2")).toBeTruthy();
  });

  it("calls onStartIncubation with the thought id from its button", () => {
    const onStartIncubation = vi.fn();
    render(
      <ThoughtPanel
        thoughts={[...thoughts]}
        onStartIncubation={onStartIncubation}
      />,
    );

    fireEvent.click(screen.getByTestId("thought-promote-t2"));
    expect(onStartIncubation).toHaveBeenCalledWith("t2");
  });
});
