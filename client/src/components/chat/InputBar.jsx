import { GrGallery } from "react-icons/gr";
import { FaMicrophone } from "react-icons/fa";
import { BsEmojiSmile } from "react-icons/bs";

const InputBar = () => {
  return (
    <div className="bg-[#2a3942] px-3 py-4 flex items-center gap-2 ">
      <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600">
        <BsEmojiSmile className="text-xl text-white" />
      </button>

      <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600">
        <GrGallery className="text-xl text-white" />
      </button>

      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 bg-gray-600 rounded-full px-4 py-2 outline-none placeholder:text-white text-white text-base font-medium"
      />

      <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200">
        <FaMicrophone className="text-gray-600" />
      </button>

      <button className="w-10 h-10 flex items-center justify-center rounded-full bg-[#00BFA5]">
        <svg width="22" height="18" fill="white" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
};

export default InputBar;
