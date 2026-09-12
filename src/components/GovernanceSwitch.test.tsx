import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GovernanceSwitch } from "./GovernanceSwitch";

const mocks = vi.hoisted(() => ({
  settings: {} as { enableGovernance?: boolean } & Record<string, unknown>,
  updateSettings: vi.fn(),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => mocks,
}));

describe("GovernanceSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the governance toggle reflecting the setting", () => {
    mocks.settings = { enableGovernance: true };

    render(<GovernanceSwitch />);

    const toggle = screen.getByRole("switch", { name: "Governance" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("wires toggle changes into updateSettings", () => {
    mocks.settings = { enableGovernance: false };

    render(<GovernanceSwitch />);

    const toggle = screen.getByRole("switch", { name: "Governance" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      enableGovernance: true,
    });
  });
});
