import React, { useState } from "react";
import { useParams } from "react-router-dom";
import ChatHeader from "../components/chat/ChatHeader";
import MessageArea from "../components/chat/MessageArea";
import InputBar from "../components/chat/InputBar";
import WelcomeScreen from "../components/WelcomeScreen";

const Chat = () => {
  const {userId} = useParams;
  console.log(userId);

  return (
    <div className="flex flex-col h-full w-full">
      <ChatHeader />
      <MessageArea />
      <InputBar />
    </div>
  );
};

export default Chat;