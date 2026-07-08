import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useSocket } from "../context/SocketContext";
import { IoClose } from "react-icons/io5";
import { FaCamera } from "react-icons/fa";

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const { token } = useSocket();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupPicFile, setGroupPicFile] = useState(null);
  const [groupPicPreview, setGroupPicPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingContacts, setFetchingContacts] = useState(true);
  const fileInputRef = useRef();

  // Fetch all available contacts to select members from
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/getAllContacts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setContacts(res.data.user);
      } catch (err) {
        console.error("Failed to load contacts for group creation:", err);
      } finally {
        setFetchingContacts(false);
      }
    };
    if (token) fetchContacts();
  }, [token]);

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (groupPicPreview) URL.revokeObjectURL(groupPicPreview);
      setGroupPicFile(file);
      setGroupPicPreview(URL.createObjectURL(file));
    }
  };

  const handleToggleMember = (contactId) => {
    setSelectedMembers((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("groupName", groupName);
    formData.append("description", description);
    formData.append("members", JSON.stringify(selectedMembers));
    
    if (groupPicFile) {
      formData.append("groupPic", groupPicFile);
    }

    try {
      await axios.post(
        `${API_BASE_URL}/api/groups/create`,
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        }
      );
      
      // Clean up local preview object URL
      if (groupPicPreview) {
        URL.revokeObjectURL(groupPicPreview);
      }
      
      onGroupCreated();
    } catch (err) {
      console.error("Failed to create group:", err);
      alert("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (groupPicPreview) {
        URL.revokeObjectURL(groupPicPreview);
      }
    };
  }, [groupPicPreview]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-message-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl flex flex-col gap-5 relative animate-message-in">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h3 className="text-zinc-800 dark:text-zinc-100 font-bold text-xl tracking-tight">Create New Group</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Start a fresh conversation with friends</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 dark:text-zinc-500 hover:text-[#ff3b30] dark:hover:text-[#ff453a] hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded-full cursor-pointer transition-all duration-150"
            title="Close"
          >
            <IoClose className="text-xl" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Circular Photo Upload */}
          <div className="flex flex-col items-center gap-2 mb-1">
            <div 
              onClick={() => fileInputRef.current.click()}
              className="group relative w-24 h-24 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-[#007aff] dark:hover:border-[#007aff] flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-150 shadow-inner bg-zinc-50 dark:bg-zinc-800/40"
            >
              {groupPicPreview ? (
                <img src={groupPicPreview} alt="Group Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-zinc-400 dark:text-zinc-500 group-hover:text-[#007aff] transition-colors">
                  <FaCamera className="text-2xl mb-1.5" />
                  <span className="text-[10px] font-semibold">Upload Photo</span>
                </div>
              )}
              {groupPicPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-150">
                  <FaCamera className="text-xl animate-scale-in" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePicChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {/* Text Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400">Group Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Project Alpha"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-2xl p-3 outline-none text-sm text-zinc-800 dark:text-zinc-100 focus:border-[#007aff] dark:focus:border-[#007aff] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400">Description</label>
              <input
                type="text"
                placeholder="What is this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-2xl p-3 outline-none text-sm text-zinc-800 dark:text-zinc-100 focus:border-[#007aff] dark:focus:border-[#007aff] transition-all"
              />
            </div>
          </div>

          {/* Members Checklist */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400">Select Members</label>
            <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {fetchingContacts ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 p-2 text-center">Loading contacts...</p>
              ) : contacts.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 p-2 text-center">No contacts found</p>
              ) : (
                contacts.map((contact) => {
                  const isChecked = selectedMembers.includes(contact._id);
                  return (
                    <label 
                      key={contact._id} 
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer select-none transition-all duration-150"
                    >
                      {/* Left Side: Avatar & Name info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[#007aff] flex items-center justify-center text-xs font-bold shadow-sm shrink-0 overflow-hidden">
                          {contact.profilePic ? (
                            <img src={contact.profilePic} alt={contact.fullName} className="h-full w-full object-cover" />
                          ) : (
                            contact.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                            {contact.fullName}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                            {contact.email}
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Custom Checkbox */}
                      <div className="relative flex items-center shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMember(contact._id)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-150 ${
                          isChecked
                            ? "bg-[#007aff] border-[#007aff] text-white scale-105"
                            : "border-zinc-300 dark:border-zinc-700 bg-transparent"
                        }`}>
                          {isChecked && (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !groupName.trim()}
            className="mt-2 w-full py-3.5 bg-[#007aff] hover:bg-[#007aff]/95 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white font-bold text-sm rounded-2xl cursor-pointer hover:scale-[1.01] active:scale-100 transition-all select-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span>Creating Group...</span>
              </>
            ) : (
              "Create Group"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
