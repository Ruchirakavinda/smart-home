// backend/src/models/TelemetryReading.ts

import { Schema, model, Document } from "mongoose";

export interface ITelemetryReading extends Document {
  deviceId: string;
  timestamp: Date;
  reading: number;
  unit: string;
  location: string;
  deviceType: string;
}

const TelemetryReadingSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    reading: { type: Number, required: true },
    unit: { type: String, required: true, default: "W" },
    location: { type: String, required: true },
    deviceType: { type: String, required: true },
  },
  {
    collection: "telemetry_readings",
    timestamps: false,
  }
);

TelemetryReadingSchema.index({ timestamp: 1, deviceId: 1 });

export const TelemetryReading = model<ITelemetryReading>(
  "TelemetryReading",
  TelemetryReadingSchema
);
