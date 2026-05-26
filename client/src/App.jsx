import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import { Toaster } from "sonner";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SignUp />,
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
      <Toaster
        position="bottom-right"/>
      <RouterProvider router={router} />
    </>
  );
};

export default App;
