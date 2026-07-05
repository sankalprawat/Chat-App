import axios from "axios";
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/config";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const Contacts = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, onlineUsers } = useSocket();

  const fetchContacts = async () => {
    try {
      if (!token) return;
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/getAllContacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setContacts(res.data.user);
    } catch (error) {
      console.log("Contacts error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="flex gap-3.5 p-2.5 items-center rounded-xl">
            <div className="h-11 w-11 rounded-full animate-shimmer shrink-0" />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="h-4 w-28 rounded animate-shimmer" />
              <div className="h-3 w-12 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {contacts.map((contact) => {
        const isActive = userId === contact._id;
        return (
          <div
            key={contact._id}
            className={`flex gap-3.5 p-2.5 items-center hover:cursor-pointer rounded-xl transition-all duration-150 ${
              isActive 
                ? "bg-[#007aff]/10 dark:bg-[#007aff]/20 text-white" 
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-100"
            }`}
            onClick={() => navigate(`/chat/${contact._id}`)}
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center font-medium shadow-sm shrink-0 ${
              isActive ? "bg-[#007aff]/20 text-white" : "bg-zinc-250 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300"
            }`}>
              {contact.profilePic ? (
                <img
                  src={contact.profilePic}
                  alt={contact.fullName}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                contact.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className={`font-semibold text-sm truncate ${isActive ? "text-white" : "text-zinc-800 dark:text-zinc-100"}`}>{contact.fullName}</p>
              <p className={`text-[11px] font-medium mt-0.5 ${onlineUsers?.includes(contact._id) ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`}>
                {onlineUsers?.includes(contact._id) ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Contacts;
