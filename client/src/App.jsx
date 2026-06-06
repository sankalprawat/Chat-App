import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import { Toaster } from "sonner";
import MainLayout from "../src/layouts/MainLayout";
import Chat from "./pages/Chat";
import Group from "./pages/Group";
import Profile from "./pages/Profile";
import WelcomeScreen from "./components/WelcomeScreen";

const token = localStorage.getItem("token");

const router = createBrowserRouter([
  {
    path: "/",
    element: token ? <MainLayout /> : <Navigate to="/signup" />,
    children: [
      {
        index: true,
        element: <WelcomeScreen />,
      },
      {
        path: "chat",
        element: <div>Select User to start chat</div>,
      },
      {
        path: "chat/:userId",
        element: <Chat />,
      },
      {
        path: "group/:groupId",
        element: <Group />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
    ],
  },
  {
    path: "/signup",
    element: <SignUp />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "*",
    element: (
      <p className="text-red-500 text-center text-3xl mt-8 font-bold">
        Error 404: Page not found!
      </p>
    ),
  },
]);

const App = () => {
  return (
    <>
      <Toaster position="bottom-right" />
      <RouterProvider router={router} />
    </>
  );
};

export default App;
