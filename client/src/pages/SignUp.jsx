import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "../api/config";
import { signInWithGoogle } from "../config/firebase";
import { useSocket } from "../context/SocketContext";

const toastStyle = {
  style: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #374151",
    borderRadius: "8px",
  },
};

const SignUp = () => {
  const { login } = useSocket();
  const appName = "Chat App";

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      toast.error("Please fill out all the required fields!", toastStyle);
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters!", toastStyle);
      setLoading(false);
      return;
    }

    try {
      const [res] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/signup`, formData),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      console.log(res);
      toast.success("Account created successfully!", {
        style: {
          border: "1px solid green",
          borderRadius: "8px",
        },
      });
      setFormData({ fullName: "", password: "", email: "" });
      navigate("/login");
    } catch (error) {
      console.log(error);
      toast.error(
        error.response?.data?.message || "Something went wrong!",
        toastStyle,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const googleUser = await signInWithGoogle();
      const res = await axios.post(`${API_BASE_URL}/api/googleLogin`, {
        email: googleUser.email,
        fullName: googleUser.displayName,
        profilePic: googleUser.photoURL,
        googleId: googleUser.uid,
      });
      toast.success("Logged in successfully!", {
        style: {
          background: "#111827",
          color: "#ffffff",
          border: "1px solid #16a34a",
          borderRadius: "8px",
        },
      });
      const token = res.data.data.token;
      login(token, res.data.data.user);
      navigate("/chat");
    } catch (error) {
      console.log("google login error", error);
      toast.error(
        error.response?.data?.message || "Google login failed!",
        toastStyle,
      );
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="hidden md:flex md:w-1/2 bg-gray-950 text-white flex-col justify-between p-12">
        <h1 className="text-4xl font-semibold mb-4">
          Create your free account →
        </h1>
      </div>

      <div className="w-full md:w-1/2 bg-white flex flex-col p-6 md:p-12 overflow-y-auto">
        <div className="flex justify-end text-sm text-gray-500 mb-10">
          Already have an account?
          <Link
            to="/login"
            className="text-blue-600 font-medium hover:underline ml-1"
          >
            Login →
          </Link>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Sign up for <span className="text-[#007aff]">{appName}</span> today
        </h2>

        <button
        onClick={handleGoogleLogin}
        className="flex items-center justify-center gap-2 w-full border border-gray-300 rounded-md py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 mb-3 hover:cursor-pointer">
          <img
            src="https://www.google.com/favicon.ico"
            alt=""
            className="h-5 w-5"
          />
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 text-gray-400 text-xs mb-4">
          <hr className="flex-1 border-gray-200" />
          or
          <hr className="flex-1 border-gray-200" />
        </div>

        <form onSubmit={handleSignup}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Full Name <sup className="text-red-500">*</sup>
              </label>
              <input
                value={formData.fullName}
                onChange={handleChange}
                type="text"
                placeholder="Full Name"
                name="fullName"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Email <sup className="text-red-500">*</sup>
              </label>
              <input
                value={formData.email}
                onChange={handleChange}
                type="email"
                placeholder="Email"
                name="email"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Password <sup className="text-red-500">*</sup>
              </label>
              <input
                value={formData.password}
                onChange={handleChange}
                type="password"
                placeholder="Password"
                name="password"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#007aff] hover:opacity-95 text-white text-sm font-semibold py-2 rounded-md mt-2 hover:cursor-pointer disabled:opacity-70 transition-all shadow-sm shadow-[#007aff]/15"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating...
                </div>
              ) : (
                "Create account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
