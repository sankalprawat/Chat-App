import axios from "axios";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {API_BASE_URL} from '../api/config'

const toastStyle = {
  style: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #374151",
    borderRadius: "8px",
  },
};

const Login = () => {
  const appName = "WhatsApp";
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error("Please fill out all the required fields!", toastStyle);
      setLoading(false);
      return;
    }

    try {
      const [res] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/login`, formData),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      console.log(res);
      toast.success("Logged in successfully!", {
        style: {
          background: "#111827",
          color: "#ffffff",
          border: "1px solid #16a34a",
          borderRadius: "8px",
        },
      });
      setFormData({email:"", password:""})
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Something went wrong!", toastStyle);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950 text-white items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col">
        <h1 className="text-4xl font-semibold mb-6">
          Login to <span className="text-green-500">{appName}</span>
        </h1>

        <form onSubmit={handleLogin}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Email <sup className="text-red-500">*</sup>
              </label>
              <input
                value={formData.email}
                type="email"
                placeholder="Email"
                className="w-full border border-gray-600 bg-transparent rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                name="email"
                onChange={handleChange}
                />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-100 mb-1">
                Password <sup className="text-red-500">*</sup>
              </label>
              <input
                value={formData.password}
                type="password"
                placeholder="Password"
                className="w-full border border-gray-600 bg-transparent rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                name="password"
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-md mt-2 hover:cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <div className="flex w-full items-center gap-3 text-gray-400 text-xs mt-6 mb-2">
          <hr className="flex-1 border-gray-600" />
          or
          <hr className="flex-1 border-gray-600" />
        </div>

        <button className="flex items-center justify-center gap-2 w-full border border-gray-600 rounded-md py-2 text-sm font-medium bg-[#212830] text-gray-100 hover:bg-[#2c343e] mt-3 hover:cursor-pointer">
          <img src="https://www.google.com/favicon.ico" alt="" className="h-5 w-5" />
          <span>Continue with Google</span>
        </button>

        <div className="flex justify-center text-sm text-gray-400 mt-10">
          Don't have an account?
          <Link to="/signup" className="text-blue-500 font-medium hover:underline ml-1">
            Sign up →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;