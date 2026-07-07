import { GrGallery } from "react-icons/gr";
import { FaMicrophone } from "react-icons/fa";
import { BsEmojiSmile } from "react-icons/bs";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import { useSocket } from "../../context/SocketContext";
import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import EmojiPicker from "emoji-picker-react";
import { useTheme } from "../../context/ThemeContext";

const InputBar = ({ setMessages }) => {
  const [fileUrl, setFileUrl] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { token } = useSocket();
  const { userId } = useParams();
  const fileInputRef = useRef();
  const inputRef = useRef();
  const emojiPickerRef = useRef();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    inputRef.current?.focus();
  }, [userId]);

  // Detect mobile/tablet by checking primary pointer type
  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    setIsMobileOrTablet(isTouchPrimary && !hasFinePointer);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!text.trim() && fileUrl.length === 0) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("text", text);
      fileUrl.forEach((item) => {
        formData.append("files", item.file);
      });
      const res = await axios.post(
        `${API_BASE_URL}/api/send-message/${userId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessages((prev) => [...prev, res.data.data]);
      setText("");
      fileUrl.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setFileUrl([]);
    } catch (error) {
      console.log(error.response);
      toast.error(error.response?.data?.message || "Failed to upload media. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleRemoveFile = (index) => {
    URL.revokeObjectURL(fileUrl[index].previewUrl);
    setFileUrl((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-2.5 md:px-4 py-2.5 md:py-3.5 flex items-center gap-1.5 md:gap-2.5 transition-colors duration-200">
      {/* Emoji Picker Popover (Only rendered on desktop/laptops) */}
      {!isMobileOrTablet && (
        <div ref={emojiPickerRef} className="relative">
          <button
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] transition-colors cursor-pointer shrink-0"
          >
            <BsEmojiSmile className="text-xl" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-12 left-0 z-50 shadow-2xl border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-message-in">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={theme === "dark" ? "dark" : "light"}
                lazyLoadEmojis={true}
              />
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => fileInputRef.current.click()}
        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] transition-colors cursor-pointer shrink-0"
      >
        <GrGallery className="text-lg" />
      </button>
 
      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        onChange={(e) => {
          const newFiles = Array.from(e.target.files).map(file => ({
            file,
            previewUrl: URL.createObjectURL(file)
          }));
          setFileUrl((prev) => [...prev, ...newFiles]);
        }}
      />
 
      {/* Unified pill — previews + text input */}
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 focus-within:border-zinc-300 dark:focus-within:border-zinc-650 rounded-2xl px-4 py-2 transition-all">
        {fileUrl.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {fileUrl.map((item, i) => (
              <div className="relative" key={i}>
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
                  onClick={() => handleRemoveFile(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-4.5 w-4.5 flex justify-center items-center text-[10px] shadow-sm cursor-pointer hover:bg-red-650 transition-colors"
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !sending) handleSend();
          }}
          className="w-full bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-800 dark:text-zinc-100 text-sm py-0.5"
        />
      </div>
 
      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer shrink-0">
        <FaMicrophone />
      </button>
 
      <button
        onClick={handleSend}
        disabled={sending}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer shrink-0 ${
          sending
            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-600"
            : "bg-[#007aff] hover:opacity-95 text-white shadow-sm shadow-[#007aff]/15"
        }`}
      >
        {sending ? (
          <svg className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
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