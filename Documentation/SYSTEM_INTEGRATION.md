# 🔄 System Integration & Flow Documentation

This document explains how the different modules of the Chatting Application connect and collaborate. It acts as an integration walkthrough, tracing specific user actions across the frontend React client, the backend Express API, the database, and third-party integrations (Firebase and Cloudinary).

---

## 🗺️ Table of Contents
1. [Scenario 1: Logging In (Auth Handshake)](#1-scenario-1-logging-in-auth-handshake)
2. [Scenario 2: Establishing the WebSocket Connection (Presence Loop)](#2-scenario-2-establishing-the-websocket-connection-presence-loop)
3. [Scenario 3: Sending a Message with Media (Data Lifecycle)](#3-scenario-3-sending-a-message-with-media-data-lifecycle)

---

## 1. Scenario 1: Logging In (Auth Handshake)

When a user logs in using Google, the frontend, Google Identity Providers, your database, and your Express server run a security handshake:

```
[React Frontend] ────► [Firebase (Google)] ──(Credentials)──► [React Frontend]
       │                                                             │
       ▼                                                             ▼
Store JWT Token ◄──(Returns Local JWT)── [Express API] ◄───(Forward User Profile)
```

### Detailed Flow Walkthrough
1. **Google Popup Trigger**:  
   In [Login.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/pages/Login.jsx#L67-L92), clicking the Google Login button triggers the `handleGoogleLogin` function, which calls `signInWithGoogle` defined in [firebase.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/config/firebase.js#L30-L36).
2. **Google Authentication Callback**:  
   Firebase displays the Google authentication overlay. Once the user enters their credentials, Firebase returns a user object containing their Google email, display name, photo URL, and Google UID.
3. **Express Endpoint Dispatch**:  
   The client-side code takes this information and makes an HTTP POST request to the backend `/api/googleLogin` endpoint, declared in [auth.route.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/routes/auth.route.js#L10).
4. **Mongoose Database Synchronization**:  
   The route delegates execution to the `googleLogin` function in [auth.controller.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/auth.controller.js#L84-L118). Mongoose searches for an existing user record using [User.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/User.js):
   - If the user has never logged in before, Mongoose registers them (storing email, full name, profile picture, and Google UID). No password is required.
   - If the user exists, Mongoose updates their profile details and retrieves the user document.
5. **Local JWT Generation**:  
   The controller generates a local JWT (JSON Web Token) containing the database user ID, signed with the server's `JWT_SECRET` key, and sends it back to the client.
6. **Client Storage Hook**:  
   The client receives the token and the user's details, saving them under `"token"` and `"user"` in the browser's `localStorage` before navigating the user to the chat interface.

---

## 2. Scenario 2: Establishing the WebSocket Connection (Presence Loop)

Once authenticated, the frontend must establish a persistent connection to receive incoming messages and observe user presence:

```
[Client App.jsx] ────► [Socket Handshake] ────► [socket.auth.middleware.js]
                                                           │ (JWT Verified)
                                                           ▼
[Client Contacts] ◄─── (onlineUser event) ◄── [Socket userSocketMap Registry]
```

### Detailed Flow Walkthrough
1. **Instantiation Hook**:  
   Upon component mounting, the `useEffect` hook in [App.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/App.jsx#L60-L79) checks if a token is present in `localStorage`. If so, it establishes a connection to the WebSocket server using `socket.io-client`.
2. **WebSocket Handshake Authentication**:  
   The connection request is intercepted by the server-side socket configuration in [socket.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/socket.js#L10) and passes through the socket authentication middleware [socket.auth.middleware.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/socket.auth.middleware.js). The token is verified using the same `JWT_SECRET`. If verification fails, the connection is rejected.
3. **Session Registering**:  
   After verification, the socket instance is registered in the backend memory map:
   ```javascript
   const userId = socket.userId;
   userSocketMap[userId] = socket.id;
   ```
4. **Targeted Room Creation**:  
   The server calls `socket.join(userId.toString())`. This maps the connection to a room specific to that user ID.
5. **Presence Sync Broadcast**:  
   The server broadcasts an updated list of all online user IDs to all connected clients using the `onlineUser` event:
   ```javascript
   io.emit("onlineUser", Object.keys(userSocketMap));
   ```
6. **UI State Update**:  
   The client [App.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/App.jsx#L69-L72) catches the `onlineUser` payload, updates the `onlineUsers` array in its state, and distributes it through [SocketContext.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/context/SocketContext.jsx).
7. **Contact Status Sync**:  
   The [Contacts.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/Contacts.jsx#L53-L55) sidebar component checks if each contact's database ID is in the `onlineUsers` list, updating their display status to "Online" (green) or "Offline" (gray) dynamically.

---

## 3. Scenario 3: Sending a Message with Media (Data Lifecycle)

This scenario details the sequence of events when sending a message with text and a media file (such as a picture):

```
[Client UI] ──(FormData)──► [Multer Middleware] ──(Temp Cache File)──► [Cloudinary Upload]
                                                                                │
                                                                                ▼
[Client UI] ◄──(WS Broadcast)── [Socket Server] ◄───(Emit Event)◄─── [Message Controller]
                                                                                │
                                                                                ▼
                                                                        [MongoDB Record]
```

### Detailed Flow Walkthrough
1. **Preparing Form Data**:  
   When files or text are submitted, [InputBar.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/chat/InputBar.jsx#L20-L48) appends them to a multipart `FormData` object and sends it via an HTTP POST request to the `/api/send-message/:receiverId` endpoint.
2. **Local Storage Buffering (Multer)**:  
   The request is processed by the backend middleware [multer.middleware.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/multer.middleware.js), which caches the upload files on disk inside the `server/uploads/` directory.
3. **Cloud CDN Streaming**:  
   Next, [cloudinary.middleware.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/cloudinary.middleware.js) reads the temporary files:
   - For files larger than 10MB, it uses Cloudinary's chunked `upload_large` function.
   - For smaller files, it uses the standard `upload` API.
   - The files are uploaded to the `chatingApp` cloud folder.
4. **Disk Cache Cleanup**:  
   Immediately after the cloud upload completes, the middleware deletes the local temporary files from the `server/uploads/` directory to prevent disk overflow:
   ```javascript
   if (fs.existsSync(file.path)) {
     fs.unlinkSync(file.path);
   }
   ```
5. **Database Entry Creation**:  
   The secure Cloudinary URLs are returned and passed to `sendMessage` in [message.controller.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/message.controller.js#L22-L53). A message record is created in MongoDB using the schema in [Message.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/models/Message.js) containing the text, sender and receiver IDs, and media URLs.
6. **Real-time Event Broadcast**:  
   The controller imports the active Socket server instance via `getIO()` and emits a `newMessage` event to the receiver's personal room:
   ```javascript
   io.to(receiverId.toString()).emit("newMessage", newMessage);
   ```
7. **UI Event Handlers**:  
   If the recipient is online, their browser catches the socket event in [MessageArea.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/chat/MessageArea.jsx#L42-L52), adds the message payload to the local `messages` state list, and scrolls the message feed to reveal the new chat bubble.
