import React from "react";
import { IconContext } from "react-icons";
import { MdOutlineChat } from "react-icons/md";

const WelcomeScreen = () => {
  const appName = "WhatsApp"; 

  return (
    <div className="flex-1 bg-[#111111] flex flex-col items-center justify-center h-full w-full">
      {/* Subtle Icon Container */}
      <div className="bg-white/5 p-6 rounded-full mb-6 text-neutral-600 shadow-inner">
        <IconContext.Provider
          value={{
            color: "#d4d4d4",
            className: "global-class-name",
            size: "38px",
          }}
        >
          <MdOutlineChat />
        </IconContext.Provider>
      </div>

      {/* Typography */}
      <h2 className="text-2xl font-semibold text-neutral-300 tracking-wide">
        Welcome to <span className="text-green-500">{appName}</span>
      </h2>
      <p className="text-neutral-500 mt-2 text-sm">
        Select someone from the sidebar to start messaging.
      </p>
    </div>
  );
};

export default WelcomeScreen;