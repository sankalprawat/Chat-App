import React from "react";
import { IconContext } from "react-icons";
import { MdOutlineChat } from "react-icons/md";

const WelcomeScreen = () => {
  const appName = "Chat App"; 

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center h-full w-full px-6 transition-colors duration-200">
      {/* Subtle Icon Container */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl mb-5 text-[#007aff] shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
        <IconContext.Provider
          value={{
            color: "currentColor",
            size: "34px",
          }}
        >
          <MdOutlineChat />
        </IconContext.Provider>
      </div>

      {/* Typography */}
      <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
        Welcome to <span className="text-[#007aff]">{appName}</span>
      </h2>
      <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm text-center max-w-xs">
        Select a conversation from the sidebar list to start messaging.
      </p>
    </div>
  );
};

export default WelcomeScreen;