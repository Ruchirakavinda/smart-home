// backend/src/server.ts
import express from "express";
import * as http from "http";
import mongoose from "mongoose";
import cors from "cors";
import routes from "./routes";
import { initWebSocket } from "./websocket";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI_TO_USE = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;

if (MONGO_URI_TO_USE) {
  mongoose
    .connect(MONGO_URI_TO_USE)
    .then(() => console.log("✅ MongoDB connected successfully."))
    .catch((err) => {
      console.error("MongoDB connection error:", err);
    });
} else {
  console.error(
    "❌ MONGO_URI environment variable is not set. Cannot connect to DB."
  );
}

app.use(express.json());
app.use(cors());

app.use("/", routes);

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[server]: API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WS stream: ws://localhost:${PORT}/ws/telemetry`);
});
