import React, { useState, useEffect } from "react";
import { IoMdArrowBack } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../api/config";

const Profile = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ fullName: "", email: "", profilePic: "" });
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#111111]">
        <div className="w-12 h-12 border-4 border-green-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#111111] flex flex-col overflow-y-auto">
      {/* Header Banner Area */}
      <div className="bg-[#161817] pt-5 pb-8 px-6 relative border-b border-neutral-800">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 text-neutral-400 hover:cursor-pointer transition-colors p-2 rounded-full hover:bg-white/5"
        >
          <IoMdArrowBack size={24} />
        </button>

        <div className="flex flex-col items-center justify-center mt-2">
          <div className="h-28 w-28 bg-neutral-800 rounded-full flex items-center justify-center border-2 border-[#111111] shadow-lg mb-4 text-neutral-500 overflow-hidden">
            {formData.profilePic ? (
              <img src={formData.profilePic} alt="profile" className="w-full h-full object-cover" />
            ) : (
              <CgProfile size={64} />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">{formData.fullName}</h1>
          <p className="text-neutral-400 mt-1 text-sm">{formData.email}</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        <h2 className="text-xs font-bold text-green-500 tracking-widest mb-4 uppercase">
          Account Info
        </h2>

        <div className="bg-white/5 rounded-xl border border-neutral-800 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-[#111111] border border-neutral-700 rounded-lg px-4 py-3 text-neutral-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
            />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-[30px] transition-colors shadow-sm hover:cursor-pointer">
            Update Profile
          </button>

          <button className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/50 font-semibold py-3.5 rounded-[30px] transition-all hover:cursor-pointer">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;