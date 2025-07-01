import express from "express";
import {
  getMessages,
  getUsersForSidebar,
  markMessageAsSeen,
  sendMessage,
} from "../controllers/messageController.js";
import { protectRoute } from "../middleware/auth.js";

const messagesRouter = express.Router();

messagesRouter.get("/users", protectRoute, getUsersForSidebar);
messagesRouter.get("/:id", protectRoute, getMessages);
messagesRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messagesRouter.post("/send/:id", protectRoute, sendMessage);

export default messagesRouter;
