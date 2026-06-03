import React from "react";

const GroupTab = () => {
  const groups = [
    { _id: "1", groupName: "React Developers", participants: 12 },
    { _id: "2", groupName: "College Friends", participants: 8 },
    { _id: "3", groupName: "Project Team", participants: 5 },
    { _id: "4", groupName: "Family", participants: 6 },
  ];

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {groups.map((group) => (
        <div
          key={group._id}
          className="flex gap-4 mt-4 p-2 items-center hover: cursor-pointer hover:bg-gray-800 hover:rounded-2xl"
          //   onClick={() => navigate(`/chat/${contact._id}`)}
        >
          <div className="h-12 w-12 rounded-full bg-gray-600 text-white flex items-center justify-center">
            {group.groupName ? group.groupName.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex flex-col justify-between">
            <p className="text-white font-medium">{group.groupName}</p>
            <p className="text-white text-xs">
              Participants: {group.participants}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupTab;
