import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { FaPlus } from "react-icons/fa";
import { CgProfile } from "react-icons/cg";
import { MdOutlineChat } from "react-icons/md";
import { useNavigate, Outlet } from "react-router-dom";
import { IconContext } from "react-icons";
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
    <div className="h-screen w-screen flex bg-white">
      {/* Sidebar */}
      <div className="bg-[rgb(22,23,23)] w-1/4 min-w-75 border-r border-neutral-800 p-4 flex flex-col">
        {/* Header */}
        <div className="py-2 flex items-center justify-between mb-4">
          {/* Left Group: Profile Icon & Name */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate("/profile")}
              className="text-neutral-300 p-2 -ml-2 rounded-full cursor-pointer text-2xl hover:text-white hover:bg-white/10 transition-all"
              title="Profile"
            >
              <CgProfile />
            </div>
            <div className="text-neutral-100 font-semibold text-lg tracking-wide">
              {userName}
            </div>
          </div>

          {/* Right Group: Add Icon */}
          <div
            className="text-neutral-400 hover:text-white hover:bg-white/10 p-2.5 rounded-full cursor-pointer text-sm transition-all"
            title="Add New"
          >
            <FaPlus />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-between border-b border-neutral-800 mt-2">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-3 text-sm font-medium transition-all
      ${
        activeTab === "chats"
          ? "text-white border-b-2 border-white"
          : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
      }`}
          >
            Chats
          </button>

          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 py-3 text-sm font-medium transition-all
      ${
        activeTab === "groups"
          ? "text-white border-b-2 border-white"
          : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
      }`}
          >
            Groups
          </button>
        </div>
        {activeTab === "chats" ? <Contacts /> : <GroupTab />}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#111111] overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
