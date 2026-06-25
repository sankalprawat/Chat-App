import React, { useState, useEffect } from "react";
import { IoChevronBack, IoSunnyOutline, IoMoonOutline } from "react-icons/io5";
import { FiUser, FiSliders, FiLogOut, FiCheck, FiCamera } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useTheme } from "../context/ThemeContext";
import { toast } from "sonner";
import Profile from "./Profile";

const toastStyle = {
  style: {
    background: "var(--toast-bg)",
    color: "var(--toast-color)",
    border: "1px solid var(--toast-border)",
    borderRadius: "12px",
  },
};

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "appearance"
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    profilePic: "",
  });

  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/getProfile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFormData(res.data.user);
    } catch (error) {
      console.log(error.response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-zinc-950 transition-colors">
        <div className="w-10 h-10 border-4 border-[#007aff] rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Apple Navigation Bar */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#007aff] hover:opacity-80 transition-opacity font-medium"
        >
          <IoChevronBack size={20} />
          <span>Back</span>
        </button>
        <h1 className="font-semibold text-lg">Settings</h1>
        <button
          onClick={handleLogout}
          className="text-red-500 hover:text-red-600 transition-colors font-medium flex items-center gap-1 text-sm md:hidden"
        >
          <FiLogOut size={15} />
          <span>Sign Out</span>
        </button>
        <div className="w-12 hidden md:block"></div> {/* spacer to center title */}
      </div>

      {/* Main Settings Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-5xl w-full mx-auto md:p-6 gap-4 md:gap-6">
        
        {/* Left Pane - Navigation List / Horizontal Tabs on Mobile */}
        <div className="w-full md:w-80 bg-white dark:bg-zinc-900 md:rounded-2xl border-b md:border border-zinc-200 dark:border-zinc-800 p-3 md:p-4 flex flex-row md:flex-col justify-between shrink-0 shadow-sm gap-2">
          <div className="flex md:flex-col gap-1.5 w-full">
            
            {/* Quick Profile Summary - Hidden on Mobile */}
            <div className="hidden md:flex items-center gap-3 p-3 mb-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                {formData.profilePic ? (
                  <img src={formData.profilePic} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <FiUser size={22} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{formData.fullName || "User"}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{formData.email}</p>
              </div>
            </div>

            {/* Tabs / Buttons */}
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-[#007aff] text-white shadow-sm shadow-[#007aff]/20"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <FiUser size={18} />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setActiveTab("appearance")}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "appearance"
                  ? "bg-[#007aff] text-white shadow-sm shadow-[#007aff]/20"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <FiSliders size={18} />
              <span>Appearance</span>
            </button>
          </div>

          {/* Logout Button - Desktop Only */}
          <button
            onClick={handleLogout}
            className="hidden md:flex w-full items-center justify-center gap-2 mt-6 md:mt-0 px-4 py-3 rounded-xl text-sm font-medium border border-red-200/60 dark:border-red-900/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <FiLogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Right Pane - Detail View */}
        <div className="flex-1 bg-white dark:bg-zinc-900 md:rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 overflow-y-auto shadow-sm">
          
          {activeTab === "profile" && (
            <Profile theme={theme} onUpdate={fetchProfile} />
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Appearance</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Choose a color mode that fits your style. Light mode offers classic clarity; Dark mode is easier on the eyes.
                </p>
              </div>

              {/* Theme Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                
                {/* Light Theme Card */}
                <div
                  onClick={() => setTheme("light")}
                  className={`border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between h-40 ${
                    theme === "light"
                      ? "border-[#007aff] bg-zinc-50/50"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoSunnyOutline className="text-amber-500 text-lg" />
                      <span className="font-semibold text-sm">Light Mode</span>
                    </div>
                    {theme === "light" && (
                      <span className="h-5 w-5 bg-[#007aff] text-white rounded-full flex items-center justify-center">
                        <FiCheck size={12} />
                      </span>
                    )}
                  </div>
                  
                  {/* Miniature UI View */}
                  <div className="bg-white border border-zinc-200 rounded-lg p-2 flex gap-1.5 items-center select-none opacity-80">
                    <div className="h-4 w-4 bg-[#007aff] rounded-full shrink-0"></div>
                    <div className="space-y-1 w-full">
                      <div className="h-1.5 bg-zinc-200 rounded w-1/3"></div>
                      <div className="h-1.5 bg-zinc-100 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>

                {/* Dark Theme Card */}
                <div
                  onClick={() => setTheme("dark")}
                  className={`border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between h-40 ${
                    theme === "dark"
                      ? "border-[#007aff] bg-zinc-800/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoMoonOutline className="text-indigo-400 text-lg" />
                      <span className="font-semibold text-sm">Dark Mode</span>
                    </div>
                    {theme === "dark" && (
                      <span className="h-5 w-5 bg-[#007aff] text-white rounded-full flex items-center justify-center">
                        <FiCheck size={12} />
                      </span>
                    )}
                  </div>
                  
                  {/* Miniature UI View */}
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 flex gap-1.5 items-center select-none opacity-80">
                    <div className="h-4 w-4 bg-[#007aff] rounded-full shrink-0"></div>
                    <div className="space-y-1 w-full">
                      <div className="h-1.5 bg-zinc-700 rounded w-1/3"></div>
                      <div className="h-1.5 bg-zinc-650 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>

                {/* Future Placeholder Option */}
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col justify-center items-center text-center text-zinc-400 dark:text-zinc-500 h-40 select-none">
                  <FiSliders size={24} className="mb-2 opacity-50" />
                  <span className="font-medium text-xs">More Themes</span>
                  <span className="text-[10px] opacity-75 mt-0.5">Sepia, Slate & custom colors coming soon</span>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Settings;
