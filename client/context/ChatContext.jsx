import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const { socket, axios, authUser } = useContext(AuthContext);

  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  }, [axios]);

  const getMessages = useCallback(
    async (userId) => {
      try {
        const { data } = await axios.get(`/api/messages/${userId}`);
        setMessages(data.messages || []);
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      }
    },
    [axios]
  );

  const sendMessage = useCallback(
    async (messageData) => {
      if (!selectedUser) return false;

      try {
        const fullMessageData = {
          ...messageData,
          senderId: authUser._id,
        };
        console.log(
          "Sending message to:",
          `/api/messages/send/${selectedUser._id}`,
          fullMessageData
        ); // Debug log
        const { data } = await axios.post(
          `/api/messages/send/${selectedUser._id}`,
          fullMessageData
        );
        if (data.success) {
          setMessages((prev) => [...prev, data.newMessage]);
          return true;
        } else {
          toast.error(data.message);
          return false;
        }
      } catch (error) {
        console.error("Send message error:", error);
        toast.error(error.response?.data?.message || error.message);
        return false;
      }
    },
    [axios, selectedUser, authUser]
  );

  const subscribeToMessages = useCallback(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        setMessages((prev) => [...prev, { ...newMessage, seen: true }]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else {
        setUnseenMessages((prev) => ({
          ...prev,
          [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
        }));
      }
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, selectedUser, axios]);

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id);
    } else {
      setMessages([]);
    }
  }, [selectedUser, getMessages]);

  useEffect(() => {
    const cleanup = subscribeToMessages();
    return cleanup;
  }, [subscribeToMessages]);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessage,
    setMessages,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
