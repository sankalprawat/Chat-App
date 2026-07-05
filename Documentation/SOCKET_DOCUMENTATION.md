# 🔌 Socket.io Real-Time Synchronization & Communication Documentation

This document explains the principles of real-time communication using Socket.io and details how it is integrated into this application's codebase.

---

## 🗺️ Table of Contents
1. [WebSockets vs. HTTP: Core Differences](#1-websockets-vs-http-core-differences)
2. [Why Socket.io?](#2-why-socketio)
3. [Backend Socket Architecture](#3-backend-socket-architecture)
4. [Socket Handshake Authentication](#4-socket-handshake-authentication)
5. [Frontend Socket Integration](#5-frontend-socket-integration)
6. [Real-Time Event Lifecycles in the Code](#6-real-time-event-lifecycles-in-the-code)
7. [The Concept of Rooms](#7-the-concept-of-rooms)
8. [Scaling Sockets in Production](#8-scaling-sockets-in-production)

---

## 1. WebSockets vs. HTTP: Core Differences

Traditional web requests use the **HTTP (Hypertext Transfer Protocol)**:
- **Unidirectional**: The client requests data, and the server responds. The server cannot initiate communication to send updates.
- **Stateless & High Overhead**: Each request opens a new TCP connection, transmits headers, returns data, and closes, adding overhead.
- **Polling**: To mock real-time updates, the client must repeatedly query the server (e.g., every 5 seconds), wasting bandwidth.

**WebSockets** provide a different model:
- **Full-Duplex Bidirectional**: A single TCP connection remains open. Both client and server can send data at any time.
- **Low Overhead**: After the initial handshake, message packets require minimal framing overhead, making real-time delivery possible.

---

## 2. Why Socket.io?

While native WebSockets allow for bi-directional communication, **Socket.io** provides a layer of reliability features built on top:
- **Fallback Support**: It starts with HTTP long-polling and upgrades to WebSockets when supported.
- **Auto-Reconnection**: If connection drops, the client automatically attempts to reconnect with backoff strategies.
- **Rooms and Multiplexing**: Built-in support to partition connections into distinct channels (Rooms) without complex manual tracking.
- **Packet Buffering**: Buffers events when the client is disconnected and drains them upon reconnection.

---

## 3. Backend Socket Architecture

In the backend, socket services are managed in [server/services/socket.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/services/socket.js).

```
┌────────────────────────────────────────────────────────┐
│                   server/services/socket.js            │
│                                                        │
│  userSocketMap = {                                     │
│     "user_id_123": "socket_id_abc",                    │
│     "user_id_456": "socket_id_xyz"                     │
│  }                                                     │
│                                                        │
│  initSocket(server) ◄─── Bind to Express Server        │
│  getIO()            ◄─── Exposes Socket IO Instance    │
└────────────────────────────────────────────────────────┘
```

### The In-Memory Registry (`userSocketMap`)
```javascript
const userSocketMap = {}
```
This object maps user database IDs (e.g., `65bca8...`) to active WebSocket socket IDs (e.g., `Fh92_saK...`).
- When a user connects, their ID is saved to the registry.
- When they disconnect, their ID is deleted.
- If a user ID is present in `userSocketMap`, they are considered **online**.

### Initializing and Exporting Socket.io
The module exports two main functions:
1. `initSocket(server)`: Called once in [server/index.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/index.js#L25) during startup. It attaches the Socket.io server to the HTTP instance and configures CORS.
2. `getIO()`: Returns the configured instance. This allows controllers located in other files (like [message.controller.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/message.controller.js#L41)) to broadcast real-time events.

---

## 4. Socket Handshake Authentication

Before establishing a socket connection, the server validates the user's JWT token via [socket.auth.middleware.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/middleware/socket.auth.middleware.js):

```javascript
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.headers?.token || socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("No token provided"));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return next(new Error("User not found"));
    }
    socket.user = user;
    socket.userId = user._id;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
}
```
*How it works:*
1. It looks for the token in the socket handshake authentication object (`socket.handshake.auth.token`).
2. It verifies the token using the server's `JWT_SECRET`.
3. It fetches the user record from the MongoDB database, excluding their password, and appends the user details directly to the connection object (`socket.user` and `socket.userId`).
4. Calling `next()` accepts the connection; calling `next(err)` rejects the handshake.

---

## 5. Frontend Socket Integration

The client establishes a socket connection, handles cleanup, and exposes the connection to components using React Context.

### Connection Lifecycle (App.jsx)
In [App.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/App.jsx#L60-L79), the connection is managed inside a `useEffect` hook:

```javascript
useEffect(() => {
  if (token) {
    // 1. Establish connection and pass token during handshake auth
    socketRef.current = io(`${API_BASE_URL}`, {
      auth: { token }
    });

    // 2. Register connection success listener
    socketRef.current.on("connect", () => {
      setSocketConnected(true);
    });

    // 3. Register user presence update listener
    socketRef.current.on("onlineUser", (users) => {
      setOnlineUsers(users);
    });

    // 4. Clean up connection on unmount or token change
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    }
  }
}, [token]);
```

### Context Hook Distribution (SocketContext.jsx)
To make the socket instance and the list of online users accessible to any child component without passing props down multiple levels, the application uses [SocketContext.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/context/SocketContext.jsx):

```javascript
export const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);
```

Components like [MessageArea.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/chat/MessageArea.jsx#L21) access the socket using:
```javascript
const { token, socketConnected, socketRef } = useSocket();
```

---

## 6. Real-Time Event Lifecycles in the Code

Here are the custom Socket.io events implemented in the application:

### Event A: Presence Synchronization (`onlineUser`)
- **Direction**: Server ➔ All Clients (Broadcast).
- **Trigger**: A user establishes a connection or disconnects.
- **Server Dispatch**:
  ```javascript
  io.emit("onlineUser", Object.keys(userSocketMap));
  ```
- **Client Handling**:
  [App.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/App.jsx#L69-L72) intercepts this event, saves the online user IDs array to state, and [Contacts.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/Contacts.jsx#L53-L55) updates the sidebar indicators.

### Event B: Direct Messages (`newMessage`)
- **Direction**: Server ➔ Selected Recipient Client.
- **Trigger**: A client posts a message payload to `/api/send-message/:receiverId`.
- **Server Dispatch**:
  Inside [message.controller.js](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/server/controllers/message.controller.js#L41-L42), the controller retrieves the Socket.io instance and targets the recipient's room:
  ```javascript
  let io = getIO();
  io.to(receiverId.toString()).emit("newMessage", newMessage);
  ```
- **Client Handling**:
  The recipient’s browser triggers the listener in [MessageArea.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/chat/MessageArea.jsx#L42-L52):
  ```javascript
  useEffect(() => {
    if (!socketRef?.current) return;
    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    socketRef.current.on("newMessage", handleMessage);
    return () => {
      socketRef.current.off("newMessage");
    };
  }, [socketConnected]);
  ```

---

## 7. The Concept of Rooms

In Socket.io, **Rooms** are arbitrary channels that sockets can join and leave. They allow you to send events to a subset of clients without manually iterating over connections.

### Personal Rooms
In this codebase, every connecting socket is assigned to a room named after their unique User ID:
```javascript
socket.join(userId.toString());
```
Even if a user is logged in on multiple devices (like their phone and laptop), both device sockets join the same room. When the server directs messages to that room:
```javascript
io.to(receiverId.toString()).emit("newMessage", newMessage);
```
Both devices receive the message simultaneously.

### Group Channels
While group chats currently use mock data (defined in [GroupTab.jsx](file:///C:/Users/sanka/OneDrive/Desktop/Chatting%20App/client/src/components/GroupTab.jsx)), rooms are the standard way to implement them:
1. When a user opens a group chat, they join the group's room ID:
   ```javascript
   socket.join(groupId);
   ```
2. When a message is sent to that group, the server emits the event to the group's room:
   ```javascript
   io.to(groupId).emit("newGroupMessage", message);
   ```

---

## 8. Scaling Sockets in Production

In development, the backend runs on a single node process, and `userSocketMap` is stored in-memory. However, this approach has limitations when scaling in production:

### The Multi-Server Bottleneck
If you scale your backend horizontally across multiple servers or containers behind a load balancer:
- User A might connect to **Server 1**.
- User B might connect to **Server 2**.
- When User A sends a message to User B, Server 1 receives the request, but cannot find User B's connection in its local `userSocketMap` because User B is connected to Server 2.

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
             ┌───────────────┴───────────────┐
             ▼                               ▼
     ┌──────────────┐                 ┌──────────────┐
     │   Server 1   │                 │   Server 2   │
     │ userSocketMap│                 │ userSocketMap│
     │   (User A)   │                 │   (User B)   │
     └──────────────┘                 └──────────────┘
```

### The Solution: Redis Adapter
To resolve this, you can configure a Redis adapter (using `@socket.io/redis-adapter`):
1. **Pub/Sub Broker**: A central Redis instance acts as a message broker.
2. **Cluster Distribution**: When Server 1 emits a message to User B's room, the Redis adapter publishes the event to all servers. Server 2 receives the event and sends it to User B's socket.
3. **Shared State Store**: Active connection states can be tracked in Redis instead of local Node memory (`userSocketMap`), ensuring all backend instances can verify user presence.
