import axios from "axios";
import React, { useCallback } from "react";
import { Virtuoso } from 'react-virtuoso';
import useSWR from "swr";
import { API_BASE_URL } from "../api/config";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const ContactItem = React.memo(({ contact, isActive, isOnline, onClick }) => (
  <div
    className={`flex gap-3.5 p-2.5 items-center hover:cursor-pointer rounded-2xl transition-all duration-200 active:scale-[0.98] ${
      isActive 
        ? "bg-[#007aff]/15 dark:bg-[#007aff]/25" 
        : "hover:bg-white/50 dark:hover:bg-zinc-800/40 text-zinc-800 dark:text-zinc-100"
    }`}
    onClick={() => onClick(contact._id)}
  >
    <div className={`h-11 w-11 rounded-full flex items-center justify-center font-medium shadow-sm shrink-0 ${
      isActive ? "bg-[#007aff] text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
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
      <p className={`text-[11px] font-medium mt-0.5 ${isOnline ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`}>
        {isOnline ? "Online" : "Offline"}
      </p>
    </div>
  </div>
));

const Contacts = () => {
  const navigate = useNavigate();
  const { token, onlineUsers } = useSocket();
  const { userId: activeUserId } = useParams();

  const fetcher = async (url) => {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    return res.data.user;
  };

  const { data: contacts = [], isLoading: loading } = useSWR(
    token ? `${API_BASE_URL}/api/getAllContacts` : null,
    fetcher
  );

  // Use useCallback so the function reference doesn't change on every render
  const handleContactClick = useCallback((id) => {
    navigate(`/chat/${id}`);
  }, [navigate]);

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
    <div className="flex-1 mt-4">
      <Virtuoso
        style={{ height: '100%' }}
        data={contacts}
        itemContent={(index, contact) => (
          <div className="pr-1 pb-1.5">
            <ContactItem
              contact={contact}
              isActive={activeUserId === contact._id}
              isOnline={onlineUsers?.includes(contact._id)}
              onClick={handleContactClick}
            />
          </div>
        )}
      />
    </div>
  );
};

export default Contacts;
