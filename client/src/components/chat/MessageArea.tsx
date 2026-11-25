import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useParams } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import { API_BASE_URL } from "../../api/config";
import MediaModal, { MediaItem } from "../MediaModal";
import { FiPlay, FiHeadphones } from "react-icons/fi";
import { Message, GroupMessage, Group, User } from "../../types";

export type ChatMessage = Message | GroupMessage;

interface MessageAreaProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setGroupInfo?: React.Dispatch<React.SetStateAction<Group | null>>;
}

const PAGE_LIMIT = 50;
const START_INDEX = 100_000;

const formatTime = (isoString?: string) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

interface MessageBubbleProps {
  msg: ChatMessage;
  isMe: boolean;
  groupId?: string;
  setSelectedMedia: (media: MediaItem | null) => void;
}

const MessageBubble = React.memo(
  ({ msg, isMe, groupId, setSelectedMedia }: MessageBubbleProps) => {
    const isSenderObj =
      typeof msg.senderId === "object" && msg.senderId !== null;
    const senderName = isSenderObj
      ? (msg.senderId as User).fullName
      : "Group Member";

    return (
      <div className={`flex w-full px-4 py-2 ${isMe ? "justify-end" : "justify-start"}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl max-w-[75%] flex flex-col gap-1.5 transition-colors duration-200 ${
            isMe
              ? "bg-[#007aff] text-white rounded-tr-sm"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-sm"
          }`}
        >
          {/* Group Member Sender Name */}
          {!isMe && groupId && (
            <span className="text-[10px] font-bold text-[#007aff] dark:text-[#30b0ff] block mb-1">
              {senderName}
            </span>
          )}

          {/* Text */}
          {msg.text && (
            <p className="text-[14px] leading-relaxed select-text font-normal break-words whitespace-pre-wrap">
              {msg.text}
            </p>
          )}

          {/* Images */}
          {msg.imageUrl && msg.imageUrl.length > 0 && (
            <div
              className={`grid gap-1.5 mt-1 ${
                msg.imageUrl.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {msg.imageUrl.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt="uploaded content"
                  loading="lazy"
                  onClick={() => setSelectedMedia({ url: img, type: "image" })}
                  className="rounded-xl w-full max-h-48 object-cover border border-black/5 dark:border-white/5 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          )}

          {/* Videos */}
          {msg.videoUrl && msg.videoUrl.length > 0 && (
            <div className="mt-1 space-y-1.5">
              {msg.videoUrl.map((video, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedMedia({ url: video, type: "video" })}
                  className="relative rounded-xl overflow-hidden border border-black/5 dark:border-white/5 cursor-pointer group bg-black max-h-56 flex justify-center shadow-sm"
                >
                  <video
                    src={`${video}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="max-w-full max-h-56 object-contain opacity-80 group-hover:opacity-60 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FiPlay size={20} className="ml-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Audio */}
          {msg.audioUrl && msg.audioUrl.length > 0 && (
            <div className="mt-1 space-y-1.5">
              {msg.audioUrl.map((audio, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedMedia({ url: audio, type: "audio" })}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors shadow-sm border border-black/5 dark:border-white/5 ${
                    isMe
                      ? "bg-white/20 hover:bg-white/30 text-white"
                      : "bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isMe ? "bg-white text-[#007aff]" : "bg-[#007aff] text-white"
                    }`}
                  >
                    <FiHeadphones size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Voice Message</span>
                    <span className="text-[10px] opacity-80">Click to play</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <span
            className={`text-[9px] font-medium mt-0.5 self-end tracking-wider select-none ${
              isMe ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {formatTime(msg.createdAt)}
          </span>
        </div>
      </div>
    );
  }
);

const MessageArea = ({ messages, setMessages, setGroupInfo }: MessageAreaProps) => {
  const { userId, groupId } = useParams<{ userId?: string; groupId?: string }>();
  const { token, socket, user: loginUser } = useSocket();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [firstItemIndex, setFirstItemIndex] = useState<number>(START_INDEX);

  const chatKey = groupId ? `group:${groupId}` : `dm:${userId || ""}`;
  const chatKeyRef = useRef<string>(chatKey);
  chatKeyRef.current = chatKey;

  const loadingMoreRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Initial load on chat change with AbortController (eliminates stale page/race bugs)
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setFirstItemIndex(START_INDEX);
    if (groupId && setGroupInfo) {
      setGroupInfo(null);
    }

    if (!token || (!userId && !groupId)) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchInitial = async (attempt = 0) => {
      if (attempt === 0) setLoading(true);
      try {
        const url = groupId
          ? `${API_BASE_URL}/api/groups/${groupId}/messages?page=1&limit=${PAGE_LIMIT}`
          : `${API_BASE_URL}/api/get-message/${userId}?page=1&limit=${PAGE_LIMIT}`;

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 65_000,
        });

        if (cancelled) return;

        const fetched: ChatMessage[] = res.data.data || [];
        setMessages(fetched);
        setHasMore(fetched.length === PAGE_LIMIT);

        if (groupId && setGroupInfo && res.data.group) {
          setGroupInfo(res.data.group);
        }
        setLoading(false);
      } catch (error: any) {
        if (axios.isCancel(error) || error?.name === "CanceledError" || cancelled) {
          return;
        }
        const status = error?.response?.status;
        const isTransient = !status || status >= 500;
        if (isTransient && attempt < 3) {
          retryTimer = setTimeout(() => {
            if (!cancelled) fetchInitial(attempt + 1);
          }, 3000);
          return;
        }
        console.error("Failed to fetch messages:", error);
        setLoading(false);
      }
    };

    fetchInitial(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller.abort();
    };
  }, [userId, groupId, token, setMessages, setGroupInfo]);

  // Real-time socket listener filtered strictly to the active conversation
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      if (groupId) {
        if (String((msg as GroupMessage).groupId) !== String(groupId)) {
          return;
        }
      } else if (userId) {
        const dm = msg as Message;
        const sender =
          typeof dm.senderId === "object" && dm.senderId !== null
            ? (dm.senderId as User)._id
            : dm.senderId;
        const receiver =
          typeof dm.receiverId === "object" && dm.receiverId !== null
            ? (dm.receiverId as User)._id
            : dm.receiverId;
        const myId = String(loginUser?._id || "");
        const targetId = String(userId);
        const isRelevant =
          (String(sender) === targetId && String(receiver) === myId) ||
          (String(sender) === myId && String(receiver) === targetId);
        if (!isRelevant) {
          return;
        }
      } else {
        return;
      }

      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    const socketEvent = groupId ? "newGroupMessage" : "newMessage";
    socket.on(socketEvent, handleMessage);
    return () => {
      socket.off(socketEvent, handleMessage);
    };
  }, [socket, groupId, userId, loginUser?._id, setMessages]);

  // Cursor-based pagination triggered when user scrolls near the top
  const loadOlderMessages = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      !hasMore ||
      loading ||
      !token ||
      messagesRef.current.length === 0
    ) {
      return;
    }

    const activeChatKey = chatKeyRef.current;
    const oldest = messagesRef.current[0];
    if (!oldest?.createdAt) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        before: oldest.createdAt,
        beforeId: oldest._id,
        limit: String(PAGE_LIMIT),
      });
      const url = groupId
        ? `${API_BASE_URL}/api/groups/${groupId}/messages?${params.toString()}`
        : `${API_BASE_URL}/api/get-message/${userId}?${params.toString()}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (chatKeyRef.current !== activeChatKey) return;

      const older: ChatMessage[] = res.data.data || [];
      if (older.length < PAGE_LIMIT) {
        setHasMore(false);
      }

      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const uniqueOlder = older.filter((m) => !existingIds.has(m._id));
          if (uniqueOlder.length === 0) return prev;
          setFirstItemIndex((idx) => idx - uniqueOlder.length);
          return [...uniqueOlder, ...prev];
        });
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      if (chatKeyRef.current === activeChatKey) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [groupId, userId, token, hasMore, loading, setMessages]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-transparent px-4 py-6 space-y-4 transition-colors duration-200">
        {[
          { isMe: false, width: "w-1/2" },
          { isMe: true, width: "w-1/3" },
          { isMe: false, width: "w-2/3" },
          { isMe: true, width: "w-1/4" },
          { isMe: false, width: "w-2/5" },
        ].map((bubble, idx) => (
          <div
            key={idx}
            className={`flex w-full ${bubble.isMe ? "justify-end" : "justify-start"}`}
          >
            <div className={`h-11 ${bubble.width} rounded-2xl animate-shimmer`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-transparent transition-colors duration-200">
      <Virtuoso
        key={chatKey}
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={Math.max(messages.length - 1, 0)}
        computeItemKey={(_index, msg) => msg._id}
        startReached={loadOlderMessages}
        followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
        components={{
          Header: () =>
            loadingMore ? (
              <div className="text-center py-2 text-xs text-zinc-500">
                Loading older messages...
              </div>
            ) : (
              <div className="h-3" />
            ),
          Footer: () => <div className="h-3" />,
        }}
        itemContent={(_index, msg) => {
          const isSenderObj =
            typeof msg.senderId === "object" && msg.senderId !== null;
          const msgSenderId = isSenderObj
            ? (msg.senderId as User)._id
            : msg.senderId;
          const isMe = String(msgSenderId) === String(loginUser?._id);

          return (
            <MessageBubble
              msg={msg}
              isMe={isMe}
              groupId={groupId}
              setSelectedMedia={setSelectedMedia}
            />
          );
        }}
      />
      <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </div>
  );
};

export default MessageArea;
