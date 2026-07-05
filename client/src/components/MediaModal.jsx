import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { LuAudioLines } from "react-icons/lu";

const MediaModal = ({ media, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50 cursor-pointer"
      >
        <IoClose size={24} />
      </button>

      <div
        className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center p-4"
        onClick={(e) => {
          // Close if clicking outside the media
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {media.type === "image" && (
          <img
            src={media.url}
            alt="Full screen"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        )}

        {media.type === "video" && (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl outline-none"
          />
        )}

        {media.type === "audio" && (
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 w-full max-w-md">
            <div className="w-24 h-24 bg-gradient-to-tr from-[#007aff] to-indigo-500 rounded-full flex items-center justify-center">
              <LuAudioLines className="text-6xl "/>
            </div>
            <h3 className="text-white font-medium text-lg">{media.name || "Audio Message"}</h3>
            <audio
              src={media.url}
              controls
              autoPlay
              className="w-full outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaModal;
