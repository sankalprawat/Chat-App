import { GrGallery } from "react-icons/gr";
import { FaMicrophone } from "react-icons/fa";
import { BsEmojiSmile } from "react-icons/bs";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import { useSocket } from "../../context/SocketContext";
import { useParams } from "react-router-dom";
import { useRef, useState } from "react";

const InputBar = ({ setMessages }) => {
  const [fileUrl, setFileUrl] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { token } = useSocket();
  const { userId } = useParams();
  const fileInputRef = useRef();

  const handleSend = async () => {
    if (!text.trim() && fileUrl.length === 0) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("text", text);
      fileUrl.forEach((file) => {
        formData.append("files", file);
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
      setFileUrl([]);
    } catch (error) {
      console.log(error.response);
    } finally {
      setSending(false);
    }
  };

  const handleRemoveFile = (index) => {
    setFileUrl((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-[#2a3942] px-3 py-4 flex items-center gap-2">
      <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600">
        <BsEmojiSmile className="text-xl text-white" />
      </button>

      <button
        onClick={() => fileInputRef.current.click()}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600"
      >
        <GrGallery className="text-xl text-white" />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        onChange={(e) => setFileUrl((prev) => [...prev, ...e.target.files])}
      />

      {/* Unified pill — previews + text input */}
      <div className="flex-1 bg-gray-600 rounded-3xl px-4 py-2">
        {fileUrl.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {fileUrl.map((file, i) => (
              <div className="relative" key={i}>
                {file.type.startsWith("image") && (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                )}
                {file.type.startsWith("video") && (
                  <video
                    src={URL.createObjectURL(file)}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                )}
                {file.type.startsWith("audio") && (
                  <div className="bg-gray-500 rounded-xl px-3 py-4 text-white text-xs flex items-center gap-1">
                    <FaMicrophone className="text-sm" />
                    audio
                  </div>
                )}
                <button
                  onClick={() => handleRemoveFile(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex justify-center items-center text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !sending) handleSend();
          }}
          className="w-full bg-transparent outline-none placeholder:text-gray-400 text-white text-base"
        />
      </div>

      <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200">
        <FaMicrophone className="text-gray-600" />
      </button>

      <button
        onClick={handleSend}
        disabled={sending}
        className={`w-10 h-10 flex items-center justify-center rounded-full ${
          sending ? "bg-gray-500" : "bg-[#00BFA5]"
        }`}
      >
        <svg width="22" height="18" fill="white" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
};

export default InputBar;