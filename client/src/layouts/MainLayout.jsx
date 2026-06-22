import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { FaPlus } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { useNavigate, Outlet } from "react-router-dom";
import Contacts from "../components/Contacts";
import GroupTab from "../components/GroupTab";

const MainLayout = () => {
  const appName = "WhatsApp";
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("chats");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/getProfile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserName(res.data.user.fullName);
      } catch (error) {
        console.log(error.response);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="h-screen w-screen flex bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar */}
      <div className="bg-white dark:bg-zinc-900 w-1/4 min-w-75 border-r border-zinc-200 dark:border-zinc-800 p-4 flex flex-col transition-colors duration-200">
        {/* Header */}
        <div className="py-2 flex items-center justify-between mb-4">
          {/* Left Group: Settings Icon & Name */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate("/settings")}
              className="text-zinc-500 dark:text-zinc-400 p-2 -ml-2 rounded-full cursor-pointer text-xl hover:text-[#007aff] dark:hover:text-[#007aff] hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-all"
              title="Settings"
            >
              <IoSettingsOutline />
            </div>
            <div className="text-zinc-800 dark:text-zinc-100 font-semibold text-base tracking-tight truncate max-w-40">
              {userName}
            </div>
          </div>

          {/* Right Group: Add Icon */}
          <div
            className="text-zinc-500 dark:text-zinc-400 hover:text-[#007aff] dark:hover:text-[#007aff] hover:bg-zinc-100 dark:hover:bg-zinc-850 p-2.5 rounded-full cursor-pointer text-sm transition-all"
            title="Add New"
          >
            <FaPlus />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 mt-2">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-3 text-sm font-medium transition-all border-b-2
      ${
        activeTab === "chats"
          ? "text-[#007aff] border-[#007aff]"
          : "text-zinc-400 border-transparent hover:text-zinc-650 dark:hover:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      }`}
          >
            Chats
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 py-3 text-sm font-medium transition-all border-b-2
      ${
        activeTab === "groups"
          ? "text-[#007aff] border-[#007aff]"
          : "text-zinc-400 border-transparent hover:text-zinc-650 dark:hover:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      }`}
          >
            Groups
          </button>
        </div>
        {activeTab === "chats" ? <Contacts /> : <GroupTab />}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 overflow-hidden transition-colors duration-200">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
