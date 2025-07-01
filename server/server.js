import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import * as messageController from "./controllers/messageController.js";

const app = express();

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

// Export app for Vercel
export default app;

// ---------------------------
// Local Development with WebSockets
// ---------------------------
if (process.env.NODE_ENV !== "production") {
  import("http").then(({ createServer }) => {
    import("socket.io").then(({ Server }) => {
      const server = createServer(app);

      const io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || "*",
          methods: ["GET", "POST"],
        },
        pingTimeout: 60000,
      });

      const userSocketMap = {};

      // 🔥 Inject socket instance into controllers
      messageController.injectSocketInstance(io, userSocketMap);

      io.on("connection", (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) userSocketMap[userId] = socket.id;
        io.emit("getOnlineUsers", Object.keys(userSocketMap));

        socket.on("disconnect", () => {
          if (userId) delete userSocketMap[userId];
          io.emit("getOnlineUsers", Object.keys(userSocketMap));
        });
      });

      connectDB().then(() => {
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () =>
          console.log(`Dev server running with WebSockets on PORT ${PORT}`)
        );
      });
    });
  });
}
