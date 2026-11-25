import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import axios from "axios";
import MessageArea, { ChatMessage } from "../chat/MessageArea";

const mockParams: { userId?: string; groupId?: string } = { userId: "userB" };
const socketListeners: Record<string, (msg: any) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, cb: (msg: any) => void) => {
    socketListeners[event] = cb;
  }),
  off: vi.fn((event: string) => {
    delete socketListeners[event];
  }),
};

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn((err) => err?.name === "CanceledError"),
  },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => mockParams,
}));

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({
    token: "test-token",
    socket: mockSocket,
    user: { _id: "me", fullName: "Current User", email: "me@test.com" },
  }),
}));

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent, components }: any) => (
    <div data-testid="virtuoso-mock">
      {components?.Header?.()}
      {data.map((item: any, idx: number) => (
        <div key={item._id}>{itemContent(idx, item)}</div>
      ))}
      {components?.Footer?.()}
    </div>
  ),
}));

const TestWrapper = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  return <MessageArea messages={messages} setMessages={setMessages} />;
};

describe("MessageArea Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(socketListeners).forEach((k) => delete socketListeners[k]);
    mockParams.userId = "userB";
    mockParams.groupId = undefined;
  });

  it("ignores real-time direct messages from unrelated chats", async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: {
        data: [
          {
            _id: "m1",
            senderId: "userB",
            receiverId: "me",
            text: "Hello from B",
            createdAt: "2026-01-01T10:00:00.000Z",
          },
        ],
      },
    });

    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByText("Hello from B")).toBeInTheDocument();
    });

    // Unrelated message from userC should NOT be appended
    act(() => {
      socketListeners["newMessage"]?.({
        _id: "m2",
        senderId: "userC",
        receiverId: "me",
        text: "Secret from C",
        createdAt: "2026-01-01T10:01:00.000Z",
      });
    });

    expect(screen.queryByText("Secret from C")).not.toBeInTheDocument();

    // Relevant message from userB should be appended
    act(() => {
      socketListeners["newMessage"]?.({
        _id: "m3",
        senderId: "userB",
        receiverId: "me",
        text: "Follow up from B",
        createdAt: "2026-01-01T10:02:00.000Z",
      });
    });

    expect(screen.getByText("Follow up from B")).toBeInTheDocument();
  });

  it("ignores real-time group messages from other groups", async () => {
    mockParams.userId = undefined;
    mockParams.groupId = "group1";

    (axios.get as any).mockResolvedValueOnce({
      data: { data: [], group: { _id: "group1", groupName: "G1", members: [] } },
    });

    render(<TestWrapper />);

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith(
        "newGroupMessage",
        expect.any(Function)
      );
    });

    act(() => {
      socketListeners["newGroupMessage"]?.({
        _id: "gm-other",
        groupId: "group2",
        senderId: { _id: "userB", fullName: "Bob" },
        text: "Wrong group message",
        createdAt: "2026-01-01T10:05:00.000Z",
      });
    });

    expect(screen.queryByText("Wrong group message")).not.toBeInTheDocument();

    act(() => {
      socketListeners["newGroupMessage"]?.({
        _id: "gm-right",
        groupId: "group1",
        senderId: { _id: "userB", fullName: "Bob" },
        text: "Right group message",
        createdAt: "2026-01-01T10:06:00.000Z",
      });
    });

    expect(screen.getByText("Right group message")).toBeInTheDocument();
  });

  it("aborts in-flight fetch when switching chats", async () => {
    let capturedSignal: AbortSignal | undefined;
    (axios.get as any).mockImplementationOnce((_url: string, config: any) => {
      capturedSignal = config.signal;
      return new Promise(() => {}); // stays pending
    });

    const { rerender } = render(<TestWrapper />);
    expect(capturedSignal?.aborted).toBe(false);

    mockParams.userId = "userC";
    (axios.get as any).mockResolvedValueOnce({
      data: {
        data: [
          {
            _id: "mc1",
            senderId: "userC",
            receiverId: "me",
            text: "Chat C loaded",
            createdAt: "2026-01-01T11:00:00.000Z",
          },
        ],
      },
    });

    rerender(<TestWrapper />);

    expect(capturedSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(screen.getByText("Chat C loaded")).toBeInTheDocument();
    });
  });
});
