import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseSpecBundle,
  type SpecBundle,
} from "@/governance/core/spec_bundle_schemas";
import { useGovernanceSpecBundle } from "./use_governance";

const FIXTURE_PATH = resolve(
  __dirname,
  "../governance/__fixtures__/spec_bundle.fixture.json",
);

const mocks = vi.hoisted(() => ({
  getSpecBundle: vi.fn(),
}));

vi.mock("@/ipc/contracts/governance_contracts", () => ({
  governanceClient: {
    getSpecBundle: mocks.getSpecBundle,
  },
}));

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

describe("useGovernanceSpecBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the spec bundle for an app and exposes approval status", async () => {
    const bundle: SpecBundle = {
      ...parseSpecBundle(readFileSync(FIXTURE_PATH, "utf8")),
      approvalStatus: "pending_approval",
    };
    mocks.getSpecBundle.mockResolvedValue({ bundle, artifactVersion: 3 });

    const { result } = renderHook(() => useGovernanceSpecBundle(7), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mocks.getSpecBundle).toHaveBeenCalledWith({ appId: 7 });
    expect(result.current.approvalStatus).toBe("pending_approval");
    expect(result.current.artifactVersion).toBe(3);
    expect(result.current.bundle?.rawIntent).toBe(bundle.rawIntent);
  });

  it("exposes null status when the app has no bundle", async () => {
    mocks.getSpecBundle.mockResolvedValue(null);

    const { result } = renderHook(() => useGovernanceSpecBundle(7), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.approvalStatus).toBeNull();
    expect(result.current.bundle).toBeNull();
  });
});
