import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ServerWakeBanner from "../ServerWakeBanner";

let mockWaking = false;

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({
    isServerWaking: mockWaking,
  }),
}));

describe("ServerWakeBanner Component", () => {
  beforeEach(() => {
    mockWaking = false;
  });

  it("renders nothing when server is warm", () => {
    const { container } = render(<ServerWakeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders wake-up status banner when server is waking", () => {
    mockWaking = true;
    render(<ServerWakeBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Waking up server/i
    );
  });
});
