import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";

const FIXTURE_PATH = resolve(
  __dirname,
  "../../governance/__fixtures__/spec_bundle.fixture.json",
);

const mocks = vi.hoisted(() => ({
  getSpecBundle: vi.fn(),
  listSpecBundleHistory: vi.fn(),
  approveSpecBundle: vi.fn(),
}));

vi.mock("@/ipc/contracts/governance_contracts", () => ({
  governanceClient: mocks,
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: { enableGovernance: true },
    updateSettings: vi.fn(),
  }),
}));

import { SpecReviewPanel } from "./SpecReviewPanel";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("SpecReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approveSpecBundle.mockResolvedValue({
      approvalStatus: "approved",
      approvedAt: "2026-09-12T00:00:00Z",
    });
  });

  it("renders criteria with their verification commands and wires approve", async () => {
    const bundle: SpecBundle = parseSpecBundle(
      readFileSync(FIXTURE_PATH, "utf8"),
    );
    mocks.getSpecBundle.mockResolvedValue({ bundle, artifactVersion: 2 });
    mocks.listSpecBundleHistory.mockResolvedValue([
      { version: 1, bundle },
      { version: 2, bundle },
    ]);

    render(<SpecReviewPanel appId={7} />, { wrapper: makeWrapper() });

    await screen.findByTestId("spec-review-panel");

    expect(screen.getAllByText(/VERIFY/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/swift test --package-path anvil-macOS/).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(mocks.approveSpecBundle).toHaveBeenCalledWith({
        appId: 7,
        decision: "approve",
      }),
    );
  });

  it("renders the diff against the previous version", async () => {
    const bundle: SpecBundle = parseSpecBundle(
      readFileSync(FIXTURE_PATH, "utf8"),
    );
    const nextBundle: SpecBundle = {
      ...bundle,
      stories: [
        ...bundle.stories,
        {
          id: "US-3",
          title: "New story",
          narrative: "As a user I want a new story so that it helps",
          criteria: [{ id: "AC-1", given: "g", when: "w", then: "t" }],
        },
      ],
    };
    mocks.getSpecBundle.mockResolvedValue({
      bundle: nextBundle,
      artifactVersion: 2,
    });
    mocks.listSpecBundleHistory.mockResolvedValue([
      { version: 1, bundle },
      { version: 2, bundle: nextBundle },
    ]);

    render(<SpecReviewPanel appId={7} />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText(/\+ US-3/)).toBeTruthy());
  });

  it("wires reject with feedback", async () => {
    const bundle: SpecBundle = parseSpecBundle(
      readFileSync(FIXTURE_PATH, "utf8"),
    );
    mocks.getSpecBundle.mockResolvedValue({ bundle, artifactVersion: 1 });
    mocks.listSpecBundleHistory.mockResolvedValue([{ version: 1, bundle }]);

    render(<SpecReviewPanel appId={7} />, { wrapper: makeWrapper() });

    await screen.findByTestId("spec-review-panel");

    fireEvent.change(screen.getByPlaceholderText("Feedback for the model"), {
      target: { value: "stories lack contracts" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(mocks.approveSpecBundle).toHaveBeenCalledWith({
        appId: 7,
        decision: "reject",
        feedback: "stories lack contracts",
      }),
    );
  });
});
