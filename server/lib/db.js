import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // Set up event listeners first
    mongoose.connection.on("connected", () => {
      console.log("✅ MongoDB connected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    // Connect to MongoDB
    await mongoose.connect(`${process.env.MONGODB_URI}/chat-app`, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if no connection
    });

    console.log("🔃 Connecting to MongoDB...");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    process.exit(1); // Exit the process if connection fails
  }
};
