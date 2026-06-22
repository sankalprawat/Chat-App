import { IoArrowBackCircleOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import { useEffect, useState } from "react";
import MediaModal from "../MediaModal";

const ChatHeader = () => {
  const [user, setUser] = useState(null);
  const { token, socketConnected, onlineUsers } = useSocket();
  const navigate = useNavigate();
  const { userId } = useParams();
  console.log(onlineUsers)

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(res.data.data);
      // console.log(res.data.data);
    } catch (error) {
      console.log(error.response);
    }
  };
  useEffect(() => {
    fetchUser();
  }, [userId]);

  const name = user?.fullName || "User Name";
  const isOnline = onlineUsers.includes(userId) || false;
  const profile = user?.profilePic || null;

  const [selectedMedia, setSelectedMedia] = useState(null);

  return (
    <>
      <div className="flex items-center px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-200">
        <button
          onClick={() => navigate("/chat")}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-[#007aff] text-xl mr-2.5 transition-colors cursor-pointer"
        >
          <IoArrowBackCircleOutline />
        </button>
        <div 
          className="relative cursor-pointer mr-3 shrink-0"
          onClick={() => {
            if (profile) setSelectedMedia({ url: profile, type: "image" });
          }}
        >
          {profile ? (
            <img
              src={profile}
              alt={name}
              className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-650 dark:text-zinc-350 font-semibold text-sm select-none">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-zinc-800 dark:text-zinc-100 font-semibold text-sm truncate">{name}</span>
          <span
            className={`text-[10px] font-medium ${isOnline ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
      <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </>
  );
};

export default ChatHeader;
