import React, { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { SWRConfig } from "swr";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import ServerWakeBanner from "./components/ServerWakeBanner";

const MainLayout = lazy(() => import("./layouts/MainLayout"));
const WelcomeScreen = lazy(() => import("./components/WelcomeScreen"));
const Chat = lazy(() => import("./pages/Chat"));
const Group = lazy(() => import("./pages/Group"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));

const RouteFallback = () => (
  <div className="flex justify-center items-center h-screen w-full bg-zinc-50 dark:bg-zinc-950">
    <div className="w-8 h-8 border-4 border-[#007aff] rounded-full border-t-transparent animate-spin" />
  </div>
);

interface RouteGuardProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: RouteGuardProps) => {
  const { token } = useSocket();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: RouteGuardProps) => {
  const { token } = useSocket();
  return token ? <Navigate to="/" replace /> : <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <MainLayout />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<RouteFallback />}>
            <WelcomeScreen />
          </Suspense>
        ),
      },
      {
        path: "chat",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <WelcomeScreen />
          </Suspense>
        ),
      },
      {
        path: "chat/:userId",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Chat />
          </Suspense>
        ),
      },
      {
        path: "group/:groupId",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Group />
          </Suspense>
        ),
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Settings />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "/signup",
    element: (
      <PublicRoute>
        <Suspense fallback={<RouteFallback />}>
          <SignUp />
        </Suspense>
      </PublicRoute>
    ),
  },
  {
    path: "/login",
    element: (
      <PublicRoute>
        <Suspense fallback={<RouteFallback />}>
          <Login />
        </Suspense>
      </PublicRoute>
    ),
  },
  {
    path: "*",
    element: (
      <p className="border-2 h-screen flex justify-center items-center font-semibold text-xl">
        Page Not Found
      </p>
    ),
  },
]);

const App = () => {
  return (
    <ThemeProvider>
      <SocketProvider>
        <SWRConfig
          value={{
            shouldRetryOnError: true,
            errorRetryCount: 6,
            errorRetryInterval: 5000,
          }}
        >
          <ServerWakeBanner />
          <Toaster position="bottom-right" />
          <RouterProvider router={router} />
        </SWRConfig>
      </SocketProvider>
    </ThemeProvider>
  );
};

export default App;
