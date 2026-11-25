import React, { useEffect, useRef, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import Contacts from "../components/Contacts";
import GroupTab from "../components/GroupTab";
import { useSocket } from "../context/SocketContext";

type TabType = "chats" | "groups";

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSocket();
  const userName = user?.fullName || "";

  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyLink = async () => {
    try {
      const shareUrl = window.location.origin;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const isListView =
    location.pathname === "/" ||
    location.pathname === "/chat" ||
    location.pathname === "/chat/";

  return (
    <div className="h-screen w-screen flex bg-mesh text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar */}
      <div
        className={`bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl w-full md:w-1/4 md:min-w-75 border-r border-zinc-200/50 dark:border-zinc-800/50 p-4 flex flex-col transition-colors duration-200 shadow-[1px_0_12px_rgba(0,0,0,0.03)] z-10 ${
          isListView ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Header */}
        <div className="py-2 flex items-center justify-between mb-4">
          {/* Left Group: Settings Icon & Name */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Settings"
              onClick={() => navigate("/settings")}
              className="text-zinc-500 dark:text-zinc-400 p-2 -ml-2 rounded-full cursor-pointer text-xl hover:text-[#007aff] dark:hover:text-[#007aff] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              title="Settings"
            >
              <IoSettingsOutline />
            </button>
            <div className="text-zinc-800 dark:text-zinc-100 font-semibold text-base tracking-tight truncate max-w-40">
              {userName}
            </div>
          </div>

          {/* Right Group: Share Icon */}
          <button
            type="button"
            aria-label="Share App Link"
            onClick={() => setShowShareModal(true)}
            className="text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2.5 rounded-full cursor-pointer text-sm transition-all"
            title="Share App Link"
          >
            <FaPlus />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === "chats"
                ? "text-[#007aff] border-[#007aff]"
                : "text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            }`}
          >
            Chats
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === "groups"
                ? "text-[#007aff] border-[#007aff]"
                : "text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            }`}
          >
            Groups
          </button>
        </div>
        {activeTab === "chats" ? <Contacts /> : <GroupTab />}
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 bg-zinc-50 dark:bg-zinc-950 overflow-hidden transition-colors duration-200 ${
          isListView ? "hidden md:block" : "block"
        }`}
      >
        <Outlet />
      </div>

      {/* Share Modal Dialog Overlay */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-200 animate-message-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-sm mx-4 shadow-2xl flex flex-col gap-4 animate-message-in">
            <h3 className="text-zinc-800 dark:text-zinc-100 font-bold text-lg">
              Share Chat App
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Copy and share this link with your friends and family to invite them to chat!
            </p>

            <div className="flex gap-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl p-2 items-center">
              <input
                type="text"
                readOnly
                value={window.location.origin}
                className="flex-1 bg-transparent outline-none text-zinc-600 dark:text-zinc-300 text-sm px-2 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 select-none ${
                  copied
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-[#007aff] hover:opacity-95 text-white shadow-sm shadow-[#007aff]/15"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              className="mt-1 w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold text-sm cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
