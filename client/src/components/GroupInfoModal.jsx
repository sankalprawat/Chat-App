import React from "react";
import { IoClose } from "react-icons/io5";

const GroupInfoModal = ({ group, onClose }) => {
  if (!group) return null;

  const groupName = group.groupName || "Unnamed Group";
  const groupPic = group.groupPic || null;
  const description = group.description || "No description set.";
  const members = group.members || [];
  const adminId = group.admin?._id ? group.admin._id : group.admin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4 animate-message-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl flex flex-col gap-5 relative animate-message-in">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h3 className="text-zinc-800 dark:text-zinc-100 font-bold text-lg tracking-tight">Group Info</h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Details and participants</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 dark:text-zinc-500 hover:text-[#ff3b30] dark:hover:text-[#ff453a] hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded-full cursor-pointer transition-all duration-150"
            title="Close"
          >
            <IoClose className="text-xl" />
          </button>
        </div>

        {/* Group Photo & Basic Details */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[#007aff] flex items-center justify-center font-bold text-4xl shadow-md border border-zinc-200 dark:border-zinc-800 overflow-hidden select-none shrink-0">
            {groupPic ? (
              <img src={groupPic} alt={groupName} className="w-full h-full object-cover" />
            ) : (
              groupName.charAt(0).toUpperCase()
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <h4 className="text-zinc-800 dark:text-zinc-200 font-bold text-base">{groupName}</h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">Created {new Date(group.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Group Description */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Description</span>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl p-4 leading-relaxed whitespace-pre-wrap">
            {description}
          </div>
        </div>

        {/* Members List */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Members ({members.length})
            </span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl p-2.5 max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
            {members.map((member) => {
              const isGroupAdmin = member._id?.toString() === adminId?.toString();
              return (
                <div 
                  key={member._id} 
                  className="flex items-center justify-between p-2 rounded-xl transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[#007aff] flex items-center justify-center text-xs font-bold shadow-sm shrink-0 overflow-hidden">
                      {member.profilePic ? (
                        <img src={member.profilePic} alt={member.fullName} className="h-full w-full object-cover" />
                      ) : (
                        member.fullName?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                        {member.fullName}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  {isGroupAdmin && (
                    <span className="text-[8px] bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full select-none shrink-0 border border-emerald-500/20">
                      Admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300 font-bold text-xs rounded-2xl cursor-pointer transition-all border border-zinc-200 dark:border-zinc-800"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default GroupInfoModal;
