import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "../api/config";
import { signInWithGoogle } from "../config/firebase";
import { useSocket } from "../context/SocketContext";

const SignUp = () => {
  const { login } = useSocket();
  const appName = "Chat App";
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Please fill out all the required fields!");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters!");
      setLoading(false);
      return;
    }

    try {
      const [res] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/signup`, formData),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
      
      toast.success("Account created successfully!");
      setFormData({ fullName: "", password: "", email: "" });
      navigate("/login");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Something went wrong!");
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
      toast.success("Logged in successfully!");
      const token = res.data.data.token;
      login(token, res.data.data.user);
      navigate("/chat");
    } catch (error) {
      console.log("google login error", error);
      toast.error(error.response?.data?.message || "Google login failed!");
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        
        {/* Branding & Header */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <div className="w-16 h-16 bg-[#007aff]/10 text-[#007aff] rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">
            Join <span className="text-[#007aff]">{appName}</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Create your free account today</p>
        </div>

        <form onSubmit={handleSignup} className="w-full flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                value={formData.fullName}
                type="text"
                placeholder="Full Name"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:border-[#007aff] focus:ring-4 focus:ring-[#007aff]/10 transition-all shadow-sm"
                name="fullName"
                onChange={handleChange}
              />
            </div>

            <div className="relative">
              <input
                value={formData.email}
                type="email"
                placeholder="Email address"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:border-[#007aff] focus:ring-4 focus:ring-[#007aff]/10 transition-all shadow-sm"
                name="email"
                onChange={handleChange}
              />
            </div>

            <div className="relative">
              <input
                value={formData.password}
                type="password"
                placeholder="Password (min. 6 chars)"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:border-[#007aff] focus:ring-4 focus:ring-[#007aff]/10 transition-all shadow-sm"
                name="password"
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#007aff] hover:bg-[#0066d6] text-white text-[15px] font-bold py-4 rounded-2xl mt-2 hover:cursor-pointer disabled:opacity-70 disabled:hover:bg-[#007aff] transition-all shadow-md shadow-[#007aff]/20 active:scale-[0.98]"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Creating...</span>
              </div>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <div className="flex w-full items-center gap-4 text-zinc-400 dark:text-zinc-500 text-xs mt-8 mb-6 font-medium uppercase tracking-wider">
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
          <span>Or sign up with</span>
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 text-[15px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
          <span>Google</span>
        </button>

        <div className="flex justify-center text-[15px] text-zinc-500 dark:text-zinc-400 mt-10">
          Already have an account?
          <Link to="/login" className="text-[#007aff] font-bold hover:underline ml-1.5 transition-colors">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
