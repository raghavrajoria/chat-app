import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    // Count number of unseen messages
    const unseenMessages = {};

    // Fixed: Use Promise.all instead of promises.all
    // Fixed: Changed 'users' to 'user' in the map function
    await Promise.all(
      filteredUsers.map(async (user) => {
        const messages = await Message.find({
          senderId: user._id,
          receiverId: userId, // Fixed spelling: recieverId → receiverId
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch users", // Fixed: Removed duplicate message property
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId }, // Fixed spelling
        { senderId: selectedUserId, receiverId: myId }, // Fixed spelling
      ],
    }).sort({ createdAt: 1 }); // Added sorting by creation time

    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId, seen: false }, // Fixed spelling
      { seen: true }
    );

    // Emit event if messages were marked as seen
    const updatedCount = await Message.countDocuments({
      senderId: selectedUserId,
      receiverId: myId,
      seen: false,
    });

    if (updatedCount > 0) {
      const receiverSocketId = userSocketMap[selectedUserId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messagesSeen", { conversationId: myId });
      }
    }

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
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

    // Notify sender that their message was seen
    const senderSocketId = userSocketMap[updatedMessage.senderId];
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageSeen", { messageId: id });
    }

    res.status(200).json({ success: true, message: updatedMessage });
  } catch (error) {
    console.error("Error in markMessageAsSeen:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to mark message as seen",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id; // Fixed spelling
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({
        success: false,
        message: "Message content cannot be empty",
      });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId, // Fixed spelling
      text,
      image: imageUrl,
    });

    // Emit to receiver
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Emit to sender (for real-time update in their UI)
    const senderSocketId = userSocketMap[senderId];
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json({ success: true, newMessage }); // Fixed: Changed req.json to res.json
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};
