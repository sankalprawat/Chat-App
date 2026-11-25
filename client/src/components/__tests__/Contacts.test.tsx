import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import axios from "axios";
import Contacts from "../Contacts";

const mockNavigate = vi.fn();
const socketListeners: Record<string, ((...args: any[]) => void)[]> = {};
const mockSocket = {
  on: vi.fn((event: string, cb: (...args: any[]) => void) => {
    socketListeners[event] = socketListeners[event] || [];
    socketListeners[event].push(cb);
  }),
  off: vi.fn((event: string, cb: (...args: any[]) => void) => {
    socketListeners[event] = (socketListeners[event] || []).filter((fn) => fn !== cb);
  }),
};

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ userId: "u1" }),
}));

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({
    token: "test-token",
    user: { _id: "me" },
    onlineUsers: ["u1"],
    socket: mockSocket,
  }),
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div>
      {data.map((item: any, idx: number) => (
        <div key={item._id}>{itemContent(idx, item)}</div>
      ))}
    </div>
  ),
}));

describe("Contacts Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active contact with readable light-mode contrast and online status", async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: {
        user: [
          { _id: "u1", fullName: "Alice Active", email: "alice@test.com" },
          { _id: "u2", fullName: "Bob Offline", email: "bob@test.com" },
        ],
      },
    });

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Contacts />
      </SWRConfig>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Active")).toBeInTheDocument();
    });

    const activeName = screen.getByText("Alice Active");
    expect(activeName.className).toContain("text-[#007aff]");
    expect(activeName.className).toContain("dark:text-white");
    expect(activeName.className).not.toMatch(/(?:^|\s)text-white(?:\s|$)/);
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows error state with retry button on fetch failure", async () => {
    (axios.get as any).mockRejectedValueOnce(new Error("Network error"));

    render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <Contacts />
      </SWRConfig>
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load contacts.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("reorders known contacts optimistically on newMessage without refetching HTTP", async () => {
    Object.keys(socketListeners).forEach((k) => delete socketListeners[k]);
    (axios.get as any).mockResolvedValueOnce({
      data: {
        user: [
          { _id: "u1", fullName: "Alice Active", email: "alice@test.com" },
          { _id: "u2", fullName: "Bob Offline", email: "bob@test.com" },
        ],
      },
    });

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Contacts />
      </SWRConfig>
    );

    await waitFor(() => {
      expect(screen.getByText("Bob Offline")).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      socketListeners.newMessage?.forEach((cb) =>
        cb({ senderId: "u2", receiverId: "me", text: "ping" })
      );
    });

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons[0].textContent).toContain("Bob Offline");
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
