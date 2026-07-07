import axios from "axios";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "../api/config";
import { signInWithGoogle } from "../config/firebase";
import { useSocket } from "../context/SocketContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useSocket();
  const appName = "Chat App";
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error("Please fill out all the required fields!");
      setLoading(false);
      return;
    }

    try {
      const [res] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/login`, formData),
        new Promise((resolve) => setTimeout(resolve, 800)), // slightly shorter artificial delay
      ]);
      
      toast.success("Logged in successfully!");
      const token = res.data.data.token;
      login(token, res.data.data.user);
      setFormData({ email: "", password: "" });
      navigate("/");
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
        <div className="flex flex-col items-center mb-10 gap-2">
          <div className="w-16 h-16 bg-[#007aff]/10 text-[#007aff] rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.03 2 11c0 2.84 1.5 5.38 3.82 7.04.14.73-.24 2.11-.27 2.22-.05.15.01.32.14.41.13.09.31.09.45.02 0 0 1.95-.97 3.51-1.39C10.4 19.8 11.19 20 12 20c5.523 20 10-4.03 10-9s-4.477-9-10-9z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">
            Welcome to <span className="text-[#007aff]">{appName}</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Sign in to continue to your chats</p>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
          <div className="flex flex-col gap-4">
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
                placeholder="Password"
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
                <span>Signing in...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="flex w-full items-center gap-4 text-zinc-400 dark:text-zinc-500 text-xs mt-8 mb-6 font-medium uppercase tracking-wider">
          <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
          <span>Or continue with</span>
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
          Don't have an account?
          <Link to="/signup" className="text-[#007aff] font-bold hover:underline ml-1.5 transition-colors">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
