import React, { Suspense, useEffect, useRef, useState } from "react";
import { GrGallery } from "react-icons/gr";
import { FaMicrophone, FaStop } from "react-icons/fa";
import { BsEmojiSmile } from "react-icons/bs";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import { useSocket } from "../../context/SocketContext";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { EmojiClickData, Theme as EmojiTheme } from "emoji-picker-react";
import { useTheme } from "../../context/ThemeContext";
import { ChatMessage } from "./MessageArea";

const LazyEmojiPicker = React.lazy(() => import("emoji-picker-react"));

interface PreviewItem {
  file: File;
  previewUrl: string;
}

interface InputBarProps {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const isSupportedMediaFile = (file: File) =>
  file.type.startsWith("image/") ||
  file.type.startsWith("video/") ||
  file.type.startsWith("audio/");

const InputBar = ({ setMessages }: InputBarProps) => {
  const [fileUrl, setFileUrl] = useState<PreviewItem[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const { token } = useSocket();
  const { userId, groupId } = useParams<{ userId?: string; groupId?: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileUrlRef = useRef<PreviewItem[]>(fileUrl);
  fileUrlRef.current = fileUrl;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(false);
  const { theme } = useTheme();

  useEffect(() => {
    inputRef.current?.focus();
  }, [userId, groupId]);

  // Cleanup remaining object URLs and media streams only on unmount
  useEffect(() => {
    return () => {
      fileUrlRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Detect mobile/tablet viewport
  useEffect(() => {
    const checkMobile = () => setIsMobileOrTablet(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (inputRef.current) {
      inputRef.current.value += emojiData.emoji;
      inputRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(isSupportedMediaFile);
    const skippedCount = selectedFiles.length - validFiles.length;

    if (skippedCount > 0) {
      toast.error(
        `Skipped ${skippedCount} unsupported file(s). Only images, videos, and audio are allowed.`
      );
    }

    if (validFiles.length > 0) {
      const newFiles: PreviewItem[] = validFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setFileUrl((prev) => [...prev, ...newFiles]);
    }

    // Reset so selecting the same file again triggers onChange
    e.target.value = "";
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (blob.size > 0) {
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const audioFile = new File([blob], `voice-${Date.now()}.${ext}`, {
            type: mimeType,
          });
          setFileUrl((prev) => [
            ...prev,
            { file: audioFile, previewUrl: URL.createObjectURL(audioFile) },
          ]);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone permission error:", err);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const handleSend = async () => {
    if (sending || (!groupId && !userId)) return;
    const currentText = inputRef.current?.value || "";
    const filesSnapshot = [...fileUrl];
    if (!currentText.trim() && filesSnapshot.length === 0) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("text", currentText);
      filesSnapshot.forEach((item) => {
        formData.append("files", item.file);
      });
      const url = groupId
        ? `${API_BASE_URL}/api/groups/${groupId}/send`
        : `${API_BASE_URL}/api/send-message/${userId}`;

      const res = await axios.post(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages((prev) => {
        if (prev.some((m) => m._id === res.data.data._id)) return prev;
        return [...prev, res.data.data];
      });
      if (inputRef.current) inputRef.current.value = "";
      filesSnapshot.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setFileUrl([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error(error?.response || error);
      toast.error(
        error.response?.data?.message || "Failed to upload media. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    if (sending) return;
    setFileUrl((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 px-2.5 md:px-4 py-2.5 md:py-3.5 flex items-center gap-1.5 md:gap-2.5 transition-colors duration-200">
      {/* Emoji Picker Popover (Only rendered on desktop/laptops when opened) */}
      {!isMobileOrTablet && (
        <div ref={emojiPickerRef} className="relative">
          <button
            type="button"
            aria-label="Toggle emoji picker"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] transition-colors cursor-pointer shrink-0"
          >
            <BsEmojiSmile className="text-xl" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 shadow-2xl border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-message-in bg-white dark:bg-zinc-900">
              <Suspense
                fallback={
                  <div className="w-[320px] h-[400px] flex items-center justify-center text-xs text-zinc-400">
                    Loading emojis...
                  </div>
                }
              >
                <LazyEmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={(theme === "dark" ? "dark" : "light") as EmojiTheme}
                  lazyLoadEmojis={true}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        aria-label="Attach media"
        disabled={sending}
        onClick={() => fileInputRef.current?.click()}
        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
      >
        <GrGallery className="text-lg" />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        accept="image/*,video/*,audio/*"
        disabled={sending}
        onChange={handleFileChange}
      />

      {/* Unified pill — previews + text input */}
      <div className="flex-1 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-700/50 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 rounded-3xl px-4 py-2 transition-all">
        {fileUrl.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {fileUrl.map((item, i) => (
              <div className="relative" key={item.previewUrl}>
                {item.file.type.startsWith("image") && (
                  <img
                    src={item.previewUrl}
                    alt="preview"
                    className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                )}
                {item.file.type.startsWith("video") && (
                  <video
                    src={item.previewUrl}
                    muted
                    preload="metadata"
                    className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                )}
                {item.file.type.startsWith("audio") && (
                  <div className="bg-zinc-200 dark:bg-zinc-700 rounded-xl px-2.5 py-3 text-zinc-700 dark:text-zinc-200 text-xs flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600">
                    <FaMicrophone className="text-xs" />
                    audio
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  disabled={sending}
                  onClick={() => handleRemoveFile(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-4.5 w-4.5 flex justify-center items-center text-[10px] shadow-sm cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="text"
          ref={inputRef}
          placeholder="Type a message..."
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && !sending) {
              handleSend();
            }
          }}
          className="w-full bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-800 dark:text-zinc-100 text-sm py-0.5"
        />
      </div>

      <button
        type="button"
        aria-label={isRecording ? "Stop recording" : "Record voice message"}
        disabled={sending}
        onClick={handleToggleRecording}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
          isRecording
            ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
            : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {isRecording ? <FaStop size={14} /> : <FaMicrophone />}
      </button>

      <button
        type="button"
        aria-label="Send message"
        onClick={handleSend}
        disabled={sending}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer shrink-0 ${
          sending
            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
            : "bg-[#007aff] hover:opacity-95 text-white shadow-sm shadow-[#007aff]/15"
        }`}
      >
        {sending ? (
          <svg
            className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        ) : (
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default InputBar;
