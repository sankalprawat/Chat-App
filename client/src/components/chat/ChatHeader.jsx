import { IoArrowBackCircleOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import { useEffect, useState } from "react";

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

  return (
    <div className="flex items-center px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
      <button
        onClick={() => navigate("/chat")}
        className="p-2 hover:bg-[#2a3942] rounded-full text-white text-2xl mr-3 -m-2"
      >
        <IoArrowBackCircleOutline />
      </button>
      <div className="relative cursor-pointer mr-3">
        {profile ? (
          <img
            src={profile}
            alt={name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-base select-none">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[#e9edef] font-medium text-sm">{name}</span>
        <span
          className={`text-xs ${isOnline ? "text-[#00a884]" : "text-[#8696a0]"}`}
        >
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
};

export default ChatHeader;
