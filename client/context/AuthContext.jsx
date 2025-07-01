import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import io from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUser, setOnlineUser] = useState([]);
  const [socket, setSocket] = useState(null);

  // Fixed: Added error handling for missing token
  const checkAuth = async () => {
    if (!token) return;

    try {
      const { data } = await axios.get("/api/auth/check", {
        headers: { token },
      });

      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      // Fixed: Proper error message extraction
      toast.error(error.response?.data?.message || "Authentication failed");
    }
  };

  // Fixed: Consistent state spelling ("signup" vs "Sign up")
  const login = async (state, credentials) => {
    try {
      const endpoint = state.toLowerCase().includes("sign")
        ? "signup"
        : "login";
      console.log("Hitting endpoint:", endpoint, "with data:", credentials);

      const { data } = await axios.post(`/api/auth/${endpoint}`, credentials);

      console.log("Server response:", data);

      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
        axios.defaults.headers.common["token"] = data.token;
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success(data.message);
      }
    } catch (error) {
      console.log("Signup/Login error:", error.response?.data);
      toast.error(error.response?.data?.message || "Login failed");
    }
  };

  // Fixed: Added socket cleanup and header removal
  const logout = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUser([]);
    delete axios.defaults.headers.common["token"];
    toast.success("Logged out successfully");
  };

  // Fixed: Added missing return value
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body, {
        headers: { token },
      });
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
        return true;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Update failed");
      return false;
    }
  };

  // Fixed: Added socket cleanup before new connection
  const connectSocket = (userData) => {
    if (!userData) return;

    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(backendUrl, {
      query: { userId: userData._id },
    });

    newSocket.on("getOnlineUsers", setOnlineUser);
    newSocket.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    setSocket(newSocket);
  };

  // Fixed: Added cleanup for socket listeners
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["token"] = token;
      checkAuth();
    }
  }, [token]);

  useEffect(() => {
    const currentSocket = socket;
    return () => {
      if (currentSocket) {
        currentSocket.off("getOnlineUsers");
        currentSocket.off("connect_error");
        currentSocket.disconnect();
      }
    };
  }, [socket]);

  return (
    <AuthContext.Provider
      value={{
        axios,
        authUser,
        onlineUser,
        socket,
        login,
        logout,
        updateProfile,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
