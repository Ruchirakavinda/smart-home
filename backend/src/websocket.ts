// backend/src/websocket.ts

import * as WebSocket from "ws";
import { Server as HttpServer } from "http";
import { ITelemetryReading } from "./models/TelemetryReading";

const WebSocketServer = WebSocket.Server;
type WebSocketServerInstance = WebSocket.Server;

let wss: WebSocketServerInstance | null = null;

export const initWebSocket = (server: HttpServer) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("✅ New WebSocket client connected");
    ws.send(
      JSON.stringify({
        event: "status",
        message: "Connected to telemetry stream.",
      })
    );
  });

  console.log("⚡️[ws]: WebSocket server initialized.");
};

export const broadcastNewReading = (reading: ITelemetryReading) => {
  if (!wss) return;

  const message = JSON.stringify({
    event: "new_reading",
    data: reading,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
};
