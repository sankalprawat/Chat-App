import React, { useState } from 'react'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from "sonner"
import MainLayout from './layouts/MainLayout'
import Chat from './pages/Chat'
import Group from './pages/Group'
import Profile from './pages/Profile'
import WelcomeScreen from "./components/WelcomeScreen"
import { io } from "socket.io-client"
import { useEffect, useRef } from 'react'
import { API_BASE_URL } from './api/config'
import { SocketContext } from "./context/SocketContext"

const token = localStorage.getItem("token")

const router = createBrowserRouter([
  {
    path: "/",
    element: token ? <MainLayout /> : <Navigate to="/signup" />,
    children: [
      { index: true, element: <WelcomeScreen /> },
      {
        path: "chat",
        element: (
          <div className='flex items-center justify-center h-full'>Select User to start chat</div>
        )
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
        path: "profile",
        element: <Profile />
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
  const [socketConnected, setSocketConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const socketRef = useRef()

  useEffect(() => {
    if (token) {
      socketRef.current = io(`${API_BASE_URL}`, {
        auth: { token }
      })
      socketRef.current.on("connect", () => {
        console.log("Connected with Socket ID:", socketRef.current.id)
        setSocketConnected(true)
      })
      socketRef.current.on("onlineUser", (users) => {
        console.log("Online Users:", users)
        setOnlineUsers(users)
      })

      return () => {
        if (socketRef.current) socketRef.current.disconnect()
      }
    }
  }, [token])

  return (
    <>
      <SocketContext.Provider value={{ token, socketConnected, onlineUsers }}>
        <Toaster position="bottom-right" />
        <RouterProvider router={router} />
      </SocketContext.Provider>
    </>
  )
}

export default App