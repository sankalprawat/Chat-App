import axios from "axios";
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/config";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const token = localStorage.getItem("token");
  const { onlineUsers } = useSocket();
  // console.log(token);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/getAllContacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // console.log(res.data.user);
      setContacts(res.data.user);
    } catch (error) {
      console.log("Contacts error:", error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {contacts.map((contact) => (
        <div
          key={contact._id}
          className="flex gap-3.5 p-2.5 items-center hover:cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-xl transition-all duration-150"
          onClick={() => navigate(`/chat/${contact._id}`)}
        >
          <div className="h-11 w-11 rounded-full bg-zinc-250 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-medium shadow-sm shrink-0">
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
            <p className="text-zinc-800 dark:text-zinc-100 font-semibold text-sm truncate">{contact.fullName}</p>
            <p className={`text-[11px] font-medium mt-0.5 ${onlineUsers?.includes(contact._id) ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500"}`}>
              {onlineUsers?.includes(contact._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Contacts;
