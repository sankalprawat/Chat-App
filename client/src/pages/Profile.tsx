import React, { useState, useEffect, useRef } from "react";
import { FiUser, FiCamera } from "react-icons/fi";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { toast } from "sonner";
import { useSocket } from "../context/SocketContext";
import { User } from "../types";

interface ProfileProps {
  theme?: string;
  initialUser?: {
    fullName: string;
    email: string;
    profilePic?: string;
  };
  onUserUpdated?: (updatedUser: User) => void;
}

const Profile = ({ theme, initialUser, onUserUpdated }: ProfileProps) => {
  const { token, user: contextUser, setUser } = useSocket();
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    fullName: initialUser?.fullName ?? contextUser?.fullName ?? "",
    email: initialUser?.email ?? contextUser?.email ?? "",
    profilePic: initialUser?.profilePic ?? contextUser?.profilePic ?? "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialUser) {
      setFormData((prev) => ({
        fullName: initialUser.fullName ?? prev.fullName,
        email: initialUser.email ?? prev.email,
        profilePic: selectedImage ? prev.profilePic : initialUser.profilePic ?? "",
      }));
    }
  }, [initialUser, selectedImage]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleUpdateProfile = async () => {
    const trimmedName = formData.fullName.trim();
    const trimmedEmail = formData.email.trim();
    if (!trimmedName || !trimmedEmail) {
      toast.error("Full name and email cannot be empty.");
      return;
    }

    try {
      setUpdating(true);
      const data = new FormData();
      data.append("fullName", trimmedName);
      data.append("email", trimmedEmail);
      if (selectedImage) {
        data.append("profileImage", selectedImage);
      }

      const res = await axios.put<{ data: User }>(`${API_BASE_URL}/api/updateProfile`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updatedUser = res.data.data;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setSelectedImage(null);

      setFormData({
        fullName: updatedUser.fullName || "",
        email: updatedUser.email || "",
        profilePic: updatedUser.profilePic || "",
      });

      setUser((prev) => {
        const merged = prev ? { ...prev, ...updatedUser } : updatedUser;
        localStorage.setItem("user", JSON.stringify(merged));
        return merged;
      });

      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }

      toast.success("Profile updated successfully", {
        style: {
          background: theme === "dark" ? "#18181b" : "#ffffff",
          color: theme === "dark" ? "#ffffff" : "#18181b",
          border: "1px solid #007aff",
          borderRadius: "12px",
        },
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

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
          <div className="h-24 w-24 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-400 dark:text-zinc-500 shrink-0">
            {formData.profilePic ? (
              <img
                src={formData.profilePic}
                alt="Profile Avatar"
                className="h-full w-full object-cover"
              />
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
                const file = e.target.files?.[0];
                if (file) {
                  if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                  }
                  const objectUrl = URL.createObjectURL(file);
                  previewUrlRef.current = objectUrl;
                  setSelectedImage(file);
                  setFormData((prev) => ({
                    ...prev,
                    profilePic: objectUrl,
                  }));
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {selectedImage && (
          <span className="text-xs text-[#007aff] font-medium mt-2">
            New image selected
          </span>
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
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, fullName: e.target.value }))
            }
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
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#007aff]/50 focus:border-[#007aff] transition-all"
          />
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
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
