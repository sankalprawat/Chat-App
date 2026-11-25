import React from "react";
import { useSocket } from "../context/SocketContext";

const ServerWakeBanner = () => {
  const { isServerWaking } = useSocket();

  if (!isServerWaking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-700 shadow-lg backdrop-blur-md text-xs font-medium text-zinc-700 dark:text-zinc-200 animate-message-in"
    >
      <span className="w-3.5 h-3.5 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin shrink-0" />
      <span>Waking up server… this can take 30–60s on free hosting.</span>
    </div>
  );
};

export default ServerWakeBanner;
