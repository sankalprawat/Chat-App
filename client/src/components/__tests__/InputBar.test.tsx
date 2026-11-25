import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { toast } from "sonner";
import InputBar from "../chat/InputBar";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ userId: "userB" }),
}));

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({ token: "test-token" }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("InputBar Component", () => {
  let urlCounter = 0;
  const createObjectURLMock = vi.fn(() => `blob:preview-${++urlCounter}`);
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    urlCounter = 0;
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  it("does not revoke earlier preview URLs when adding another file", () => {
    const setMessages = vi.fn();
    const { container, unmount } = render(<InputBar setMessages={setMessages} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toBe("image/*,video/*,audio/*");

    const file1 = new File(["img1"], "one.png", { type: "image/png" });
    const file2 = new File(["img2"], "two.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file1] } });
    fireEvent.change(fileInput, { target: { files: [file2] } });

    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    // Removing first preview revokes only its URL
    const removeButtons = screen.getAllByRole("button", { name: "Remove attachment" });
    fireEvent.click(removeButtons[0]);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:preview-1");

    // Unmounting revokes remaining preview URL
    unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:preview-2");
  });

  it("rejects unsupported file types with toast error", () => {
    const setMessages = vi.fn();
    const { container } = render(<InputBar setMessages={setMessages} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdfFile = new File(["pdf"], "doc.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(toast.error).toHaveBeenCalled();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
});
