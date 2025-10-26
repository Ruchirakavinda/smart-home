// backend/src/controllers/TelemetryController.ts
import { Request, Response } from "express";
import {
  TelemetryReading,
  ITelemetryReading,
} from "../models/TelemetryReading";
import { DeviceMetadata } from "../models/DeviceMetadata";
import { broadcastNewReading } from "../websocket";

// --- Helper: Update/Create Device Metadata ---
const upsertDeviceMetadata = async (reading: ITelemetryReading) => {
  await DeviceMetadata.findByIdAndUpdate(
    reading.deviceId,
    {
      $set: {
        name: reading.deviceId,
        location: reading.location,
        deviceType: reading.deviceType,
        lastReported: reading.timestamp,
        status: "online",
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

// POST /api/v1/devices/ingest (Ingestion Logic)

export const ingestTelemetry = async (req: Request, res: Response) => {
  try {
    const readings = Array.isArray(req.body) ? req.body : [req.body];

    if (readings.length === 0) {
      return res.status(400).json({ message: "No telemetry data provided." });
    }

    const savedReadings = await TelemetryReading.insertMany(readings);

    if (savedReadings.length > 0) {
      const uniqueDeviceIds = new Set(savedReadings.map((r) => r.deviceId));

      for (const deviceId of uniqueDeviceIds) {
        const latestReading = savedReadings.find(
          (r) => r.deviceId === deviceId
        );

        if (latestReading) {
          await upsertDeviceMetadata(latestReading as ITelemetryReading);
        }
      }
    }

    broadcastNewReading(savedReadings[0] as ITelemetryReading);

    res.status(202).json({
      message: "Telemetry accepted and broadcasted",
      count: savedReadings.length,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({
      message: "Failed to ingest data",
      error: (error as Error).message,
    });
  }
};

// GET /health

export const getHealthStatus = (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "smart-home-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
