import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from "sonner"
import MainLayout from './layouts/MainLayout'
import Chat from './pages/Chat'
import Group from './pages/Group'
import Settings from './pages/Settings'
import WelcomeScreen from "./components/WelcomeScreen"
import { io } from "socket.io-client"
import { API_BASE_URL } from './api/config'
import { SocketContext, useSocket } from "./context/SocketContext"
import { ThemeProvider } from "./context/ThemeContext"

const ProtectedRoute = ({ children }) => {
  const { token } = useSocket()
  return token ? children : <Navigate to="/signup" replace />
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoute><MainLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <WelcomeScreen /> },
      {
        path: "chat",
        element: <WelcomeScreen />
      },
      {
        path: "chat/:userId",
        element: <Chat />
      },
      {
        path: "group/:groupId",
        element: <Group />
      },
      {
        path: "settings",
        element: <Settings />
      },
    ]
  },
  { path: "/signup", element: <SignUp /> },
  { path: "/login", element: <Login /> },
  {
    path: "*",
    element: <p className='border-2 h-screen flex justify-center items-center font-semibold text-xl'>Page Not Found</p>
  }
])

const App = () => {
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"))
  const [socketConnected, setSocketConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const socketRef = useRef()

  const login = (newToken, newUser) => {
    localStorage.setItem("token", newToken)
    localStorage.setItem("user", JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setToken(null)
    setUser(null)
    setOnlineUsers([])
    setSocketConnected(false)
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }

  // Global Axios Interceptor for 401 Unauthorized
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    if (token) {
      socketRef.current = io(`${API_BASE_URL}`, {
        auth: { token }
      })
      socketRef.current.on("connect", () => {
        setSocketConnected(true)
      })
      socketRef.current.on("onlineUser", (users) => {
        setOnlineUsers(users)
      })

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }
      }
    }
  }, [token])

  return (
    <ThemeProvider>
      <SocketContext.Provider value={{ token, user, setUser, login, logout, socketConnected, onlineUsers, socketRef }}>
        <Toaster position="bottom-right" />
        <RouterProvider router={router} />
      </SocketContext.Provider>
    </ThemeProvider>
  )
}

export default App