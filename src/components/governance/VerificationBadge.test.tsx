import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationBadge } from "./VerificationBadge";

describe("VerificationBadge", () => {
  it("renders verified state and failing state from props", () => {
    const { rerender } = render(
      <VerificationBadge verified green={2} red={0} failing={[]} />,
    );

    expect(screen.getByTestId("verification-badge")).toBeTruthy();
    expect(screen.getByRole("img", { name: "verified" })).toBeTruthy();
    expect(screen.getByText("2/2 criteria green")).toBeTruthy();

    rerender(
      <VerificationBadge
        verified={false}
        green={1}
        red={1}
        failing={["US-1/AC-2"]}
      />,
    );

    expect(screen.getByTestId("verification-badge").className).toContain(
      "text-red-600",
    );
    expect(screen.getByText("US-1/AC-2")).toBeTruthy();
  });
});
