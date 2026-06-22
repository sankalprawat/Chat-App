import React, { useState, useEffect } from "react";
import { FiUser, FiCamera } from "react-icons/fi";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { toast } from "sonner";

const Profile = ({ theme, onUpdate }) => {
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    profilePic: "",
  });
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const token = localStorage.getItem("token");

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
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setUpdating(true);
      const data = new FormData();
      data.append("fullName", formData.fullName);
      data.append("email", formData.email);
      if (selectedImage) {
        data.append("profileImage", selectedImage);
      }
      const res = await axios.put(`${API_BASE_URL}/api/updateProfile`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.data.data?.profilePic) {
        setFormData((prev) => ({
          ...prev,
          profilePic: res.data.data.profilePic,
        }));
      }
      
      // Update local storage user profile
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("user", JSON.stringify({ ...parsed, ...res.data.data }));
      }

      if (onUpdate) {
        onUpdate();
      }

      toast.success("Profile updated successfully", {
        style: {
          background: theme === "dark" ? "#18181b" : "#ffffff",
          color: theme === "dark" ? "#ffffff" : "#18181b",
          border: "1px solid #007aff",
          borderRadius: "12px",
        },
      });
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-3 border-[#007aff] rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Edit Profile</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Update your display name, email address, and avatar image.
        </p>
      </div>

      {/* Avatar Uploader */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className="relative group">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-450 dark:text-zinc-550 shrink-0">
            {formData.profilePic ? (
              <img src={formData.profilePic} alt="Profile Avatar" className="h-full w-full object-cover" />
            ) : (
              <FiUser size={40} />
            )}
          </div>
          <label className="absolute inset-0 bg-black/40 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-xs gap-1">
            <FiCamera size={18} />
            <span>Upload</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setSelectedImage(file);
                  setFormData({
                    ...formData,
                    profilePic: URL.createObjectURL(file),
                  });
                }
              }}
            />
          </label>
        </div>
        {selectedImage && (
          <span className="text-xs text-[#007aff] font-medium mt-2">New image selected</span>
        )}
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#007aff]/50 focus:border-[#007aff] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#007aff]/50 focus:border-[#007aff] transition-all"
          />
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleUpdateProfile}
        disabled={updating}
        className="w-full bg-[#007aff] hover:opacity-95 text-white font-semibold py-3 rounded-xl transition-all shadow-sm shadow-[#007aff]/20 text-sm cursor-pointer disabled:opacity-50"
      >
        {updating ? "Saving Changes..." : "Save Profile"}
      </button>
    </div>
  );
};

export default Profile;
