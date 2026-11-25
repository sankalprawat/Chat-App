import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
  RefObject,
} from "react";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { User } from "../types";

export interface SocketContextType {
  token: string | null;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (newToken: string, newUser: User) => void;
  logout: () => void;
  socketConnected: boolean;
  onlineUsers: string[];
  socket: Socket | null;
  socketRef: RefObject<Socket | null>;
}

interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  );
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setOnlineUsers([]);
    setSocketConnected(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
  }, []);

  // Global Axios Interceptor for 401 Unauthorized
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout]);

  // Socket Connection Lifecycle
  useEffect(() => {
    if (!token) return;

    const activeSocket = io(API_BASE_URL, {
      auth: { token },
    });
    socketRef.current = activeSocket;
    setSocket(activeSocket);

    activeSocket.on("connect", () => {
      setSocketConnected(true);
    });

    activeSocket.on("disconnect", () => {
      setSocketConnected(false);
    });

    activeSocket.on("connect_error", (err) => {
      setSocketConnected(false);
      if (
        err.message === "Unauthorized" ||
        err.message === "User not found" ||
        err.message === "No token provided"
      ) {
        logout();
      }
    });

    activeSocket.on("onlineUser", (users: string[]) => {
      setOnlineUsers(users);
    });

    return () => {
      activeSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setSocketConnected(false);
    };
  }, [token, logout]);

  const contextValue = useMemo(
    () => ({
      token,
      user,
      setUser,
      login,
      logout,
      socketConnected,
      onlineUsers,
      socket,
      socketRef,
    }),
    [token, user, login, logout, socketConnected, onlineUsers, socket]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
