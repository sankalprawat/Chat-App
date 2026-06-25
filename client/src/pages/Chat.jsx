import React from 'react'
import ChatHeader from '../components/chat/ChatHeader'
import MessageArea from '../components/chat/MessageArea'
import InputBar from '../components/chat/InputBar'
import { useState } from 'react'

const Chat = () => {
  const [messages, setMessages] = useState([])

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