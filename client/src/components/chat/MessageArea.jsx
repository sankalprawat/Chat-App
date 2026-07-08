import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import { API_BASE_URL } from "../../api/config";
import MediaModal from "../MediaModal";
import { FiPlay, FiHeadphones } from "react-icons/fi";

const formatTime = (isoString) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
};

const MessageArea = ({ messages, setMessages, setGroupInfo }) => {
  const { userId, groupId } = useParams();
  const { token, socketConnected, socketRef } = useSocket();
  const loginUser = JSON.parse(localStorage.getItem("user"));
  const bottomRef = useRef();
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const containerRef = useRef(null);

  // Reset state when chat changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setMessages([]);
  }, [userId, groupId, setMessages]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!token) return;
      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);

        const url = groupId
          ? `${API_BASE_URL}/api/groups/${groupId}/messages?page=${page}&limit=50`
          : `${API_BASE_URL}/api/get-message/${userId}?page=${page}&limit=50`;

        const res = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        const newMessages = res.data.data;
        if (newMessages.length < 50) {
          setHasMore(false);
        }

        setMessages((prev) => {
          if (page === 1) return newMessages;
          
          // Filter out duplicates just in case
          const existingIds = new Set(prev.map(m => m._id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m._id));
          
          return [...uniqueNewMessages, ...prev];
        });

        if (groupId && setGroupInfo && res.data.group) {
          setGroupInfo(res.data.group);
        }
      } catch (error) {
        console.log(error.response || error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    fetchMessages();
  }, [userId, groupId, token, page, setMessages, setGroupInfo]);

  useEffect(() => {
    if (!socketRef?.current) return;

    const handleMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      // Scroll to bottom when a new message arrives
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };
    const socketEvent = groupId ? "newGroupMessage" : "newMessage";
    socketRef.current.on(socketEvent, handleMessage);
    return () => {
      socketRef.current.off(socketEvent, handleMessage);
    };
  }, [socketConnected, groupId, setMessages, socketRef]);

  // Initial scroll to bottom
  useEffect(() => {
    if (page === 1 && !loading) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading, page]);

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore && !loadingMore && !loading) {
      setPage((prev) => prev + 1);
    }
  };

  if (loading && page === 1) {
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
            <div
              className={`h-11 ${bubble.width} rounded-2xl animate-shimmer`}
            />
          </div>
        ))}
      </div>
    );
  }

const MessageBubble = React.memo(({ msg, isMe, groupId, setSelectedMedia }) => (
  <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
    <div
      className={`px-4 py-2.5 rounded-2xl max-w-[75%] flex flex-col gap-1.5 transition-colors duration-200 animate-message-in
         ${
           isMe
             ? "bg-[#007aff] text-white rounded-tr-sm"
             : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-sm"
         }`}
    >
      {/* Group Member Sender Name */}
      {!isMe && groupId && (
        <span className="text-[10px] font-bold text-[#007aff] dark:text-[#30b0ff] block mb-1">
          {msg.senderId?.fullName || "Group Member"}
        </span>
      )}
      {/* text  */}
      {msg.text && <p className="text-[14px] leading-relaxed select-text font-normal break-words whitespace-pre-wrap">{msg.text}</p>}

      {/* image  */}
      {msg.imageUrl?.length > 0 && (
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
              onClick={() => setSelectedMedia({ url: img, type: "image" })}
              className="rounded-xl w-full max-h-48 object-cover border border-black/5 dark:border-white/5 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            />
          ))}
        </div>
      )}

      {/* video  */}
      {msg.videoUrl?.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {msg.videoUrl.map((video, index) => (
            <div 
              key={index} 
              onClick={() => setSelectedMedia({ url: video, type: "video" })}
              className="relative rounded-xl overflow-hidden border border-black/5 dark:border-white/5 cursor-pointer group bg-black max-h-56 flex justify-center shadow-sm"
            >
              <video
                src={video}
                preload="none"
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

      {/* audio  */}
      {msg.audioUrl?.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {msg.audioUrl.map((audio, i) => (
            <div
              key={i}
              onClick={() => setSelectedMedia({ url: audio, type: "audio" })}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors shadow-sm border border-black/5 dark:border-white/5
                ${isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-650 text-zinc-800 dark:text-zinc-100"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-white text-[#007aff]" : "bg-[#007aff] text-white"}`}>
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

      {/* timestamp */}
      <span
        className={`text-[9px] font-medium mt-0.5 self-end tracking-wider select-none
          ${isMe ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        {formatTime(msg.createdAt)}
      </span>
    </div>
  </div>
));

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-transparent px-4 py-6 space-y-4 transition-colors duration-200"
    >
      {loadingMore && (
        <div className="text-center py-2 text-xs text-zinc-500">
          Loading older messages...
        </div>
      )}
      {messages.map((msg) => {
        const msgSenderId = msg.senderId?._id || msg.senderId;
        const isMe = msgSenderId?.toString() === loginUser?._id?.toString();
        return (
          <MessageBubble
            key={msg._id}
            msg={msg}
            isMe={isMe}
            groupId={groupId}
            setSelectedMedia={setSelectedMedia}
          />
        );
      })}
      <div ref={bottomRef}></div>
      <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </div>
  );
};

export default MessageArea;
