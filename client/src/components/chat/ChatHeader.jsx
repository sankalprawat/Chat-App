import { BsThreeDotsVertical } from "react-icons/bs";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

const ChatHeader = ({ user }) => {
  const name = user?.name || "User Name";
  const isOnline = user?.isOnline ?? true;
  const avatar = user?.avatar || null;

  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-[#2a3942] rounded-full text-white text-2xl mr-1 -m-2"
        >
          <IoArrowBackCircleOutline />
        </button>
        <div className="relative cursor-pointer">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-base select-none">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[#e9edef] font-medium text-sm">{name}</span>
          <span
            className={`text-xs ${isOnline ? "text-[#00a884]" : "text-[#8696a0]"}`}
          >
            {isOnline ? "Online" : "Last seen recently"}
          </span>
        </div>
      </div>

      {/* <div className="flex items-center gap-1">
        {[{ Icon: BsThreeDotsVertical, label: "More options" }].map(
          ({ Icon, label }) => (
            <button
              key={label}
              title={label}
              className="p-2 rounded-full text-[#aebac1] hover:bg-[#2a3942] hover:text-[#e9edef] transition-colors duration-150 "
            >
              <Icon size={20} />
            </button>
          ),
        )}
      </div> */}
    </div>
  );
};

export default ChatHeader;
