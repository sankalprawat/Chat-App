import React, { useEffect, useState } from "react";
import axios from "axios";
import useSWR from "swr";
import { API_BASE_URL } from "../api/config";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import CreateGroupModal from "./CreateGroupModal";
import { Group } from "../types";

const groupsFetcher = async ([url, authToken]: [string, string]): Promise<Group[]> => {
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  return res.data.groups;
};

const GroupTab = () => {
  const navigate = useNavigate();
  const { groupId: activeGroupId } = useParams<{ groupId: string }>();
  const { token, socket } = useSocket();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const {
    data: groups = [],
    error,
    isLoading: loading,
    mutate: fetchGroups,
  } = useSWR<Group[]>(
    token ? [`${API_BASE_URL}/api/groups`, token] : null,
    groupsFetcher
  );

  // Sync group list in real time when added to a group or when a group receives a message
  useEffect(() => {
    if (!socket) return;

    const handleGroupCreated = (newGroup: Group) => {
      fetchGroups((prev = []) => {
        if (prev.some((g) => g._id === newGroup._id)) return prev;
        return [newGroup, ...prev];
      }, false);
    };

    const handleNewGroupMessage = async (msg?: { groupId?: string | { _id?: string } }) => {
      const msgGroupId =
        typeof msg?.groupId === "string" ? msg.groupId : msg?.groupId?._id;
      if (!msgGroupId) {
        fetchGroups();
        return;
      }

      let foundInCache = false;
      await fetchGroups((prev = []) => {
        const idx = prev.findIndex((g) => g._id === msgGroupId);
        if (idx === -1) return prev;
        foundInCache = true;
        if (idx === 0) return prev;
        return [prev[idx], ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }, false);

      if (!foundInCache) {
        fetchGroups();
      }
    };

    socket.on("groupCreated", handleGroupCreated);
    socket.on("newGroupMessage", handleNewGroupMessage);
    return () => {
      socket.off("groupCreated", handleGroupCreated);
      socket.off("newGroupMessage", handleNewGroupMessage);
    };
  }, [socket, fetchGroups]);

  return (
    <div className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
        {loading ? (
          <div className="p-4 text-center text-xs text-zinc-400 animate-pulse">
            Loading Groups...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Failed to load groups.
            </p>
            <button
              type="button"
              onClick={() => fetchGroups()}
              className="text-xs font-semibold text-[#007aff] hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-400">
            No groups yet. Create one by clicking the button below!
          </div>
        ) : (
          groups.map((group) => {
            const isActive = activeGroupId === group._id;
            return (
              <button
                type="button"
                key={group._id}
                onClick={() => navigate(`/group/${group._id}`)}
                className={`w-full text-left flex gap-3.5 p-2.5 items-center hover:cursor-pointer rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? "bg-[#007aff]/15 dark:bg-[#007aff]/25 font-semibold"
                    : "hover:bg-white/50 dark:hover:bg-zinc-800/40 text-zinc-800 dark:text-zinc-100"
                }`}
              >
                <div
                  className={`h-11 w-11 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 ${
                    isActive
                      ? "bg-[#007aff] text-white"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  }`}
                >
                  {group.groupPic ? (
                    <img
                      src={group.groupPic}
                      alt={group.groupName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    group.groupName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p
                    className={`text-sm truncate ${
                      isActive
                        ? "text-[#007aff] dark:text-white"
                        : "text-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {group.groupName}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {group.members?.length} members
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating Action Button (FAB) in bottom right */}
      <button
        type="button"
        aria-label="Create New Group"
        onClick={() => setIsModalOpen(true)}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-[#007aff] hover:bg-[#007aff]/95 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 z-10 select-none"
        title="Create New Group"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
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
