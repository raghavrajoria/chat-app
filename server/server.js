import express from "express";
import cors from "cors";
import http from "http";
import "dotenv/config";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";

// Create express and http server
const app = express();
const server = http.createServer(app);

// Initialize socket.io server
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
});

// Store online users
export const userSocketMap = {}; // {userId: socketId}

// Socket.io connection handler
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected:", userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("User disconnected:", userId);
    if (userId) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // Fixed typo here
  });
});

// Middleware setup
app.use(express.json({ limit: "4mb" }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// Routes
app.use("/api/status", (req, res) => res.send("Server is Live"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    if (process.env.NODE_ENV !== "production") {
    }
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () =>
      console.log(`Server is running on PORT: ${PORT}`)
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
// export server for vercel
export default server;
startServer();
