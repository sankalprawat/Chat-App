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

const MessageArea = ({ messages, setMessages }) => {
  const { userId } = useParams();
  const { token, socketConnected, socketRef } = useSocket();
  const loginUser = JSON.parse(localStorage.getItem("user"));
  const bottomRef = useRef();
  const [selectedMedia, setSelectedMedia] = useState(null);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/get-message/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages(res.data.data);
    } catch (error) {
      console.log(error.response);
    }
  };
  useEffect(() => {
    fetchMessages();
  }, [userId]);

  useEffect(() => {
    if (!socketRef?.current) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    socketRef?.current.on("newMessage", handleMessage);
    return () => {
      socketRef?.current.off("newMessage");
    };
  }, [socketConnected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 px-4 py-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent transition-colors duration-200">
      {messages.map((msg) => {
        const isMe = msg.senderId?.toString() === loginUser?._id?.toString();
        return (
          <div
            key={msg._id}
            className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-3.5 py-2.5 rounded-2xl shadow-sm max-w-[70%] flex flex-col gap-1.5 transition-colors duration-200
                 ${
                   isMe
                     ? "bg-[#007aff] text-white rounded-tr-sm"
                     : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tl-sm"
                 }`}
            >
              {/* text  */}
              {msg.text && <p className="text-[14px] leading-relaxed select-text font-normal">{msg.text}</p>}

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
        );
      })}
      <div ref={bottomRef}></div>
      <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </div>
  );
};

export default MessageArea;
