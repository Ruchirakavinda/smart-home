// backend/src/controllers/TelemetryController.ts
import e, { Request, Response } from "express";
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

// Helper function to  extract the first string value from a query parameter
const extractString = (param: any, defaultValue: string): string => {
  if (typeof param === "string") {
    return param;
  }
  if (Array.isArray(param) && typeof param[0] === "string") {
    return param[0];
  }
  return defaultValue;
};

// POST /devices/ingest (Ingestion Logic)
// Validates a single telemetry reading object against the expected schema.

const validateReading = (reading: any): string | null => {
  if (!reading || typeof reading !== "object") {
    return "Reading must be a non-null object.";
  }

  if (
    typeof reading.deviceId !== "string" ||
    reading.deviceId.trim().length === 0
  ) {
    return "deviceId must be a non-empty string.";
  }

  if (
    typeof reading.timestamp !== "string" ||
    !new Date(reading.timestamp).getTime()
  ) {
    return "timestamp must be a valid ISO date string.";
  }

  if (typeof reading.reading !== "number" || isNaN(reading.reading)) {
    return "reading must be a number.";
  }

  if (typeof reading.unit !== "string" || reading.unit.trim().length === 0) {
    return "unit must be a non-empty string.";
  }

  if (
    typeof reading.location !== "string" ||
    reading.location.trim().length === 0
  ) {
    return "location must be a non-empty string.";
  }

  if (
    typeof reading.deviceType !== "string" ||
    reading.deviceType.trim().length === 0
  ) {
    return "deviceType must be a non-empty string.";
  }

  return null;
};

// POST /devices/ingest FUNCTION ---

export const ingestTelemetry = async (req: Request, res: Response) => {
  try {
    const readings: ITelemetryReading[] = Array.isArray(req.body)
      ? req.body
      : [req.body];

    if (readings.length === 0) {
      return res.status(400).json({ message: "No telemetry data provided." });
    }

    const invalidReadings: { index: number; error: string }[] = [];
    const validReadings: ITelemetryReading[] = [];

    readings.forEach((reading, index) => {
      const validationError = validateReading(reading);
      if (validationError) {
        invalidReadings.push({ index, error: validationError });
      } else {
        validReadings.push(reading);
      }
    });

    if (invalidReadings.length > 0) {
      console.error("Validation failed for some readings:", invalidReadings);
      return res.status(400).json({
        message: "One or more telemetry readings failed validation.",
        totalAttempted: readings.length,
        failedCount: invalidReadings.length,
        errors: invalidReadings,
      });
    }

    const savedReadings = await TelemetryReading.insertMany(validReadings);

    if (savedReadings.length > 0) {
      // ✅ Calculate total reading across all saved readings
      const totalReading = savedReadings.reduce(
        (sum, r) => sum + (r.reading || 0),
        0
      );

      // ✅ Take the latest timestamp among them
      const latestTimestamp = savedReadings
        .map((r) => new Date(r.timestamp))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      // ✅ Broadcast combined data instead of just one reading
      broadcastNewReading({
        deviceId: "all-devices",
        reading: totalReading,
        unit: savedReadings[0]?.unit || "W",
        timestamp: latestTimestamp,
        location: "aggregate",
        deviceType: "summary",
      } as unknown as ITelemetryReading);

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

    res.status(202).json({
      message: "Telemetry accepted and processed.",
      count: savedReadings.length,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).json({
      message: "Failed to ingest data due to a server error",
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

// GET /telemetry/summary

export const getTelemetrySummary = async (req: Request, res: Response) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const usageResult = await TelemetryReading.aggregate([
      {
        $match: {
          timestamp: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalUsageWh: { $sum: "$reading" },
          highestReading: { $max: "$reading" },
          baseUnit: { $first: "$unit" },
        },
      },
    ]);

    const totalUsage = usageResult[0]
      ? (usageResult[0].totalUsageWh / 1000).toFixed(2)
      : "0.00";

    const highestReading = usageResult[0]
      ? usageResult[0].highestReading.toFixed(1)
      : "0.0";

    const baseUnit = usageResult[0]?.baseUnit || "W";

    const highestReadingUnit = baseUnit;

    const totalUsageUnit = baseUnit ? `k${baseUnit}h` : "kWh";

    const onlineDevices = await DeviceMetadata.countDocuments({
      status: "online",
      lastReported: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    const totalDevices = await DeviceMetadata.countDocuments({});
    res.status(200).json({
      totalUsage: totalUsage,
      onlineDevices: onlineDevices,
      totalDevices: totalDevices,
      highestReading: highestReading,
      unit: {
        totalUsage: totalUsageUnit,
        highestReading: highestReadingUnit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error calculating summary metrics:", error);
    res.status(500).json({
      message: "Failed to calculate summary metrics",
      error: (error as Error).message,
    });
  }
};

// Get energy trends

export const getEnergyTrends = async (req: Request, res: Response) => {
  let unitType: string = "W";
  let window: string = "24h";

  try {
    const extractString = (param: any, defaultValue: string): string => {
      if (typeof param === "string") {
        return param;
      }
      if (Array.isArray(param) && typeof param[0] === "string") {
        return param[0];
      }
      return defaultValue;
    };

    window = extractString(req.query.window, "24h");
    unitType = extractString(req.query.unitType, "W");

    let startTime: Date;
    let granularity: "day" | "hour";
    let dateFormat: string;

    if (window === "7d") {
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      granularity = "day";
      dateFormat = "%Y-%m-%d";
    } else {
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      granularity = "hour";
      dateFormat = "%Y-%m-%dT%H";
    }

    const trendData = await TelemetryReading.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime },
          unit: unitType,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: "$timestamp",
            },
          },
          totalSum: { $sum: "$reading" },
        },
      },
      {
        $sort: { _id: 1 },
      },

      {
        $project: {
          _id: 0,
          timeLabel: "$_id",

          ...(unitType === "W"
            ? { usageKWh: { $divide: ["$totalSum", 1000] } }
            : { totalReading: "$totalSum" }),
        },
      },
    ]);

    const responseUnit = unitType === "W" ? "kWh" : unitType;

    res.status(200).json({
      window: window,
      unit: responseUnit,
      dataKey: unitType === "W" ? "usageKWh" : "totalReading",
      granularity: granularity,
      data: trendData,
    });
  } catch (error) {
    console.error("Error fetching telemetry trends:", error);
    res.status(500).json({
      message: `Failed to calculate trends for unit ${unitType}`,
      error: (error as Error).message,
    });
  }
};

export const getUsageBreakdown = async (req: Request, res: Response) => {
  try {
    const groupBy = req.query.by === "category" ? "deviceType" : "location";

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: sevenDaysAgo },
          unit: "W",
        },
      },

      {
        $group: {
          _id: {
            $ifNull: [`$${groupBy}`, "UNKNOWN_OR_MISSING_FIELD"],
          },
          totalWh: { $sum: "$reading" },
        },
      },

      {
        $project: {
          _id: 0,
          name: "$_id",

          value: { $divide: ["$totalWh", 1000] },
        },
      },

      {
        $match: {
          name: { $nin: ["UNKNOWN_OR_MISSING_FIELD", null] },
        },
      },
    ];

    const breakdownData = await TelemetryReading.aggregate(pipeline as any[]);

    res.status(200).json({
      groupBy: groupBy,
      unit: "kWh",
      data: breakdownData,
    });
  } catch (error) {
    console.error("Error fetching usage breakdown:", error);
    res.status(500).json({
      message: `Failed to calculate usage breakdown by ${req.query.by}`,
      error: (error as Error).message,
    });
  }
};

export const getDeviceList = async (req: Request, res: Response) => {
  try {
    const page = parseInt(extractString(req.query.page, "1"));
    const limit = parseInt(extractString(req.query.limit, "20"));

    const search = extractString(req.query.search, "");

    const sortFieldMap: { [key: string]: string } = {
      deviceId: "name",
      location: "location",
      deviceType: "deviceType",
      lastReported: "lastReported",
      status: "status",
    };

    const sortBy = extractString(req.query.sort, "lastReported");

    const sortMongoField = sortFieldMap[sortBy] || "lastReported";

    const order = extractString(req.query.order, "desc");
    const sortOrder = order === "asc" ? 1 : -1;

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res
        .status(400)
        .json({ message: "Invalid pagination parameters." });
    }

    const filterQuery: any = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };

      filterQuery.$or = [{ name: searchRegex }, { deviceType: searchRegex }];
    }

    const totalDevices = await DeviceMetadata.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalDevices / limit);
    const skip = (page - 1) * limit;

    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({ message: `Page ${page} does not exist.` });
    }

    const devices = await DeviceMetadata.find(filterQuery)
      .sort({ [sortMongoField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedDevices = devices.map((device) => ({
      deviceId: device.name,
      location: device.location,
      deviceType: device.deviceType,
      status: device.status,

      lastReported:
        device.lastReported instanceof Date
          ? device.lastReported.toISOString()
          : device.lastReported,
    }));

    res.status(200).json({
      status: "success",
      data: {
        devices: formattedDevices,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalDevices: totalDevices,
          limit: limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching device list:", error);
    res.status(500).json({
      message: "Failed to fetch device list",
      error: (error as Error).message,
    });
  }
};

export const getTelemetryReadings = async (req: Request, res: Response) => {
  try {
    const page = parseInt(extractString(req.query.page, "1"));
    const limit = parseInt(extractString(req.query.limit, "20"));

    const search = extractString(req.query.search, "");

    const startTimestampStr = extractString(req.query.startTimestamp, "");
    const endTimestampStr = extractString(req.query.endTimestamp, "");

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res
        .status(400)
        .json({ message: "Invalid pagination parameters." });
    }

    const filterQuery: any = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };

      filterQuery.$or = [
        { deviceId: searchRegex },
        { deviceType: searchRegex },
        { location: searchRegex },
      ];
    }

    const timestampFilter: any = {};

    if (startTimestampStr) {
      const startDate = new Date(startTimestampStr);
      if (!isNaN(startDate.getTime())) {
        timestampFilter.$gte = startDate;
      } else {
        return res.status(400).json({
          message:
            "Invalid startTimestamp format. Must be a valid date string or timestamp.",
        });
      }
    }

    if (endTimestampStr) {
      const endDate = new Date(endTimestampStr);
      if (!isNaN(endDate.getTime())) {
        timestampFilter.$lte = endDate;
      } else {
        return res.status(400).json({
          message:
            "Invalid endTimestamp format. Must be a valid date string or timestamp.",
        });
      }
    }

    if (Object.keys(timestampFilter).length > 0) {
      filterQuery.timestamp = timestampFilter;
    }

    const totalReadings = await TelemetryReading.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalReadings / limit);
    const skip = (page - 1) * limit;

    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({ message: `Page ${page} does not exist.` });
    }

    const readings = await TelemetryReading.find(filterQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      status: "success",
      data: {
        readings: readings,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalReadings: totalReadings,
          limit: limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching telemetry readings:", error);
    res.status(500).json({
      message: "Failed to fetch telemetry readings",
      error: (error as Error).message,
    });
  }
};
