import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import CreateGroupModal from "./CreateGroupModal";

const GroupTab = () => {
  const navigate = useNavigate();
  const { groupId: activeGroupId } = useParams();
  const { token } = useSocket();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(res.data.groups);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchGroups();
  }, [token]);

  return (
    <div className="flex-1 flex flex-col mt-4 h-[calc(100vh-140px)] overflow-hidden relative">
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {loading ? (
          <div className="p-4 text-center text-xs text-zinc-400 animate-pulse">Loading Groups...</div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-400">No groups yet. Create one by clicking the button below!</div>
        ) : (
          groups.map((group) => {
            const isActive = activeGroupId === group._id;
            return (
              <div
                key={group._id}
                onClick={() => navigate(`/group/${group._id}`)}
                className={`flex gap-3.5 p-2.5 items-center hover:cursor-pointer rounded-xl transition-all duration-150 ${
                  isActive 
                    ? "bg-[#007aff]/10 dark:bg-[#007aff]/20 text-white font-semibold" 
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-100"
                }`}
              >
                <div className="h-11 w-11 rounded-full bg-zinc-200 dark:bg-zinc-800 dark:text-white text-zinc-900 flex items-center justify-center font-bold shadow-sm shrink-0">
                  {group.groupPic ? (
                    <img src={group.groupPic} alt={group.groupName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    group.groupName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className={`text-sm truncate ${isActive ? "text-zinc-900 dark:text-white" : "text-zinc-800 dark:text-zinc-100"}`}>{group.groupName}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{group.members?.length} members</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (FAB) in bottom right */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-[#007aff] hover:bg-[#007aff]/95 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 z-10 select-none"
        title="Create New Group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {isModalOpen && (
        <CreateGroupModal 
          onClose={() => setIsModalOpen(false)} 
          onGroupCreated={() => {
            setIsModalOpen(false);
            fetchGroups();
          }} 
        />
      )}
    </div>
  );
};

export default GroupTab;
