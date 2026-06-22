import React from "react";

const GroupTab = () => {
  const groups = [
    { _id: "1", groupName: "React Developers", participants: 12 },
    { _id: "2", groupName: "College Friends", participants: 8 },
    { _id: "3", groupName: "Project Team", participants: 5 },
    { _id: "4", groupName: "Family", participants: 6 },
  ];

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {groups.map((group) => (
        <div
          key={group._id}
          className="flex gap-3.5 p-2.5 items-center hover:cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-xl transition-all duration-150"
        >
          <div className="h-11 w-11 rounded-full bg-zinc-250 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 flex items-center justify-center font-medium shadow-sm shrink-0">
            {group.groupName ? group.groupName.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <p className="text-zinc-800 dark:text-zinc-100 font-semibold text-sm truncate">{group.groupName}</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
              Participants: {group.participants}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupTab;
