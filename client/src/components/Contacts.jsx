import axios from "axios";
import React, { useEffect, useState } from "react";
import {API_BASE_URL} from '../api/config'
import { useNavigate } from "react-router-dom";

const Contacts = () => {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([]);
  const token = localStorage.getItem("token");
  // console.log(token)

  const fetchContacts = async () => {
    console.log("URL hitting:", `${API_BASE_URL}/api/getAllContacts`)
    try {
      const res = await axios.get(`${API_BASE_URL}/api/getAllContacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(res.data.user);
      setContacts(res.data.user);
    } catch (error) {}
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
      {contacts.map((contact) => (
        <div key={contact._id} className="flex gap-4 mt-4 p-2 items-center hover: cursor-pointer hover:bg-gray-800 hover:rounded-2xl" onClick={()=>navigate(`/chat/${contact._id}`)}>
          <div className="h-12 w-12 rounded-full bg-gray-600 text-white flex items-center justify-center">
            {contact.fullName ? contact.fullName.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex flex-col justify-between">
            <p className="text-white font-medium">{contact.fullName}</p>
            <p className="text-white text-xs">Online</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Contacts;
