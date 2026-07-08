import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IoArrowBackCircleOutline } from "react-icons/io5";
import MessageArea from '../components/chat/MessageArea'
import InputBar from '../components/chat/InputBar'
import GroupInfoModal from '../components/GroupInfoModal'

const Group = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const groupName = groupInfo?.groupName || "Loading Group...";
  const groupPic = groupInfo?.groupPic || null;
  const description = groupInfo?.description || "";
  const membersCount = groupInfo?.members?.length || 0;

  return (
    <div className='flex flex-col h-screen w-full bg-transparent relative'>
      
      {/* Group Chat Header */}
      <div className="flex items-center px-4 py-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-200 shadow-sm shrink-0">
        
        {/* Back navigation CTA for Mobile View */}
        <button
          onClick={() => navigate("/")}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-[#007aff] text-xl mr-2.5 transition-colors cursor-pointer"
        >
          <IoArrowBackCircleOutline />
        </button>

        {/* Group Profile Photo (Clickable to view Group Info) */}
        <div 
          onClick={() => setShowInfoModal(true)}
          className="mr-3 shrink-0 select-none cursor-pointer hover:opacity-85 active:scale-95 transition-all duration-150"
          title="View Group Info"
        >
          {groupPic ? (
            <img
              src={groupPic}
              alt={groupName}
              className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[#007aff] flex items-center justify-center font-bold text-sm">
              {groupName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Group Info Name & Description (Clickable to view Group Info) */}
        <div 
          onClick={() => setShowInfoModal(true)}
          className="flex flex-col min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-all duration-150"
          title="View Group Info"
        >
          <span className="text-zinc-800 dark:text-zinc-100 font-semibold text-sm truncate hover:text-[#007aff] dark:hover:text-[#007aff] transition-colors">{groupName}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate mt-0.5">
            {membersCount} members {description && `• ${description}`}
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <MessageArea setMessages={setMessages} messages={messages} setGroupInfo={setGroupInfo} />

      {/* Message Text Input Area */}
      <InputBar setMessages={setMessages} />

      {/* Group Info Modal */}
      {showInfoModal && (
        <GroupInfoModal 
          group={groupInfo} 
          onClose={() => setShowInfoModal(false)} 
        />
      )}
    </div>
  )
}

export default Group