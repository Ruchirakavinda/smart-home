// backend/src/models/DeviceMetadata.ts

import { Schema, model, Document } from "mongoose";

export interface IDeviceMetadata extends Document {
  _id: string;
  name: string;
  location: string;
  deviceType: string;
  lastReported: Date;
  status: "online" | "offline" | "error";
}

const DeviceMetadataSchema: Schema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    deviceType: { type: String, required: true },
    lastReported: { type: Date, required: true },
    status: {
      type: String,
      enum: ["online", "offline", "error"],
      required: true,
      default: "online",
    },
  },
  {
    collection: "device_metadata",
    timestamps: true,
  }
);

export const DeviceMetadata = model<IDeviceMetadata>(
  "DeviceMetadata",
  DeviceMetadataSchema
);
