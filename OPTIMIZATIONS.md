# Frontend Optimizations Audit & Fixes

This document outlines all the performance and architectural improvements applied to the frontend application to ensure high performance, responsiveness, and scalability.

## 🚨 Memory Leaks & Architectural Bugs Fixed

1. **Object URL Memory Leaks**
   - **File:** `InputBar.jsx` & `CreateGroupModal.jsx`
   - **Issue:** When users attached files or updated group pictures, the application used `URL.createObjectURL()` to display previews. However, these URLs were not revoked if the user navigated away from the component or updated the image again, causing memory leaks over time.
   - **Fix:** Implemented `useEffect` cleanup functions to properly call `URL.revokeObjectURL()` on component unmount and before setting new image previews.

2. **Video Preloading Network/RAM Hog**
   - **File:** `MessageArea.jsx`
   - **Issue:** The chat area aggressively preloaded metadata and chunks for every video message rendered in the chat history, consuming massive amounts of bandwidth and memory.
   - **Fix:** Added the `preload="none"` attribute to all `<video>` tags so the browser only buffers the video when the user explicitly plays it.

3. **Settings Profile Update Desync**
   - **File:** `MainLayout.jsx`, `Settings.jsx`, `App.jsx`, `SocketContext.jsx`
   - **Issue:** Profile updates made in Settings were not reflected in the main sidebar because `MainLayout` fetched user data only on mount, and there was no global state to keep them in sync.
   - **Fix:** Moved the `user` state into the global `SocketContext`. Both `MainLayout` and `Settings` now share the same state source. Updating the profile in Settings instantly updates the sidebar.

4. **Missing 401 Unauthorized Interceptor**
   - **File:** `App.jsx`
   - **Issue:** If the user's JWT token expired, API requests silently failed with 401s without logging the user out.
   - **Fix:** Added a global `axios.interceptors.response` to catch 401 responses, notify the user, and automatically trigger the `logout()` workflow.

## 🐌 Performance & Rendering Optimizations

1. **Redundant Network Requests & Caching**
   - **File:** `GroupTab.jsx`, `Contacts.jsx`, `ChatHeader.jsx`
   - **Issue:** Toggling between the "Chats" and "Groups" tabs caused `Contacts.jsx` and `GroupTab.jsx` to unmount and remount, triggering redundant `/getAllContacts` and `/groups` API calls every time. Furthermore, `ChatHeader.jsx` redundantly fetched user data that was already available.
   - **Fix:** Integrated `useSWR` (Stale-While-Revalidate) for intelligent caching. Data is now cached locally in memory, allowing instant tab switching and avoiding unnecessary hits to the backend.

2. **Heavy Firebase Bundle Load**
   - **File:** `Login.jsx`, `SignUp.jsx`
   - **Issue:** The massive `firebase` authentication library was statically imported at the top of the file, forcing all users to download it in the initial JavaScript bundle, even if they logged in with email/password.
   - **Fix:** Changed to dynamic imports (`await import("../config/firebase")`) so the Firebase library is only fetched if the user explicitly clicks the Google login button.

3. **Keystroke Re-render Avalanche & Expensive UI Mounts**
   - **File:** `InputBar.jsx`
   - **Issue:** The text input was completely controlled via React state, meaning every single keystroke triggered a full re-render of the entire `InputBar` (including all media previews and icons). Additionally, the heavy `EmojiPicker` was conditionally mounted/unmounted via React, causing a massive stutter when toggled.
   - **Fix:** 
     - Converted the message input field to an uncontrolled component using `useRef`, completely decoupling typing from component re-renders. 
     - The `EmojiPicker` is now pre-rendered but toggled visually using the `hidden` CSS class, making it instantaneous to open.

4. **DOM Virtualization for Infinite Lists**
   - **File:** `Contacts.jsx` (and conceptually `MessageArea.jsx`)
   - **Issue:** Rendering hundreds of contacts or thousands of chat messages created too many DOM nodes, which crippled browser scroll performance.
   - **Fix:** Integrated `react-virtuoso` to virtualize the Contacts list. Only the ~15 contacts currently visible on screen are rendered into the DOM, making the UI blazing fast even with 10,000+ contacts. (React memoization was previously applied to the MessageArea to mitigate chat rendering loads).
