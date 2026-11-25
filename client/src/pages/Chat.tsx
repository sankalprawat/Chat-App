import React from 'react'
import ChatHeader from '../components/chat/ChatHeader'
import InputBar from '../components/chat/InputBar'
import { useState } from 'react'
import MessageArea, { ChatMessage } from '../components/chat/MessageArea';



const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  return (
    <>
      <div className='flex flex-col h-screen w-full'>
        <ChatHeader />
        <MessageArea  setMessages={setMessages} messages={messages}/>
        <InputBar setMessages={setMessages} />
      </div>
    </>
  )
}

export default Chat