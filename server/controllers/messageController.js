import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";

// Utility function to safely emit socket events (only in dev with socket.io)
let ioInstance = null;
let userSocketMapInstance = null;

export const injectSocketInstance = (io, userSocketMap) => {
  ioInstance = io;
  userSocketMapInstance = userSocketMap;
};

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    const unseenMessages = {};

    await Promise.all(
      filteredUsers.map(async (user) => {
        const messages = await Message.find({
          senderId: user._id,
          receiverId: userId,
          seen: false,
        });
        if (messages.length > 0) {
          unseenMessages[user._id] = messages.length;
        }
      })
    );

    res
      .status(200)
      .json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId, seen: false },
      { seen: true }
    );

    if (ioInstance && userSocketMapInstance) {
      const receiverSocketId = userSocketMapInstance[selectedUserId];
      if (receiverSocketId) {
        ioInstance
          .to(receiverSocketId)
          .emit("messagesSeen", { conversationId: myId });
      }
    }

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch messages" });
  }
};

export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { seen: true },
      { new: true }
    );

    if (!updatedMessage) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    if (ioInstance && userSocketMapInstance) {
      const senderSocketId = userSocketMapInstance[updatedMessage.senderId];
      if (senderSocketId) {
        ioInstance.to(senderSocketId).emit("messageSeen", { messageId: id });
      }
    }

    res.status(200).json({ success: true, message: updatedMessage });
  } catch (error) {
    console.error("Error in markMessageAsSeen:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark message as seen" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    if (!text && !image) {
      return res
        .status(400)
        .json({ success: false, message: "Message content cannot be empty" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    if (ioInstance && userSocketMapInstance) {
      const receiverSocketId = userSocketMapInstance[receiverId];
      if (receiverSocketId) {
        ioInstance.to(receiverSocketId).emit("newMessage", newMessage);
      }

      const senderSocketId = userSocketMapInstance[senderId];
      if (senderSocketId) {
        ioInstance.to(senderSocketId).emit("newMessage", newMessage);
      }
    }

    res.status(201).json({ success: true, newMessage });
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};
