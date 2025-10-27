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
      broadcastNewReading(savedReadings[0] as ITelemetryReading);

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
      status: "online", // Simple status check
      lastReported: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Active in the last 5 minutes
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
  // FIX: Declare unitType and window outside the try block so they are accessible
  // in the catch block for error logging.
  let unitType: string = "W";
  let window: string = "24h";

  try {
    // Helper function to safely extract the first string value from a query parameter,
    // preventing 'ParsedQs' objects from being assigned to a simple string type.
    const extractString = (param: any, defaultValue: string): string => {
      if (typeof param === "string") {
        return param;
      }
      // Check if it's an array and the first element is a string
      if (Array.isArray(param) && typeof param[0] === "string") {
        return param[0];
      }
      // If it's undefined, an object (ParsedQs), or anything else, use the default.
      return defaultValue;
    };

    // Retrieve and normalize query parameters (safely extracting string values)
    window = extractString(req.query.window, "24h");
    unitType = extractString(req.query.unitType, "W");

    let startTime: Date;
    let granularity: "day" | "hour";
    let dateFormat: string;

    if (window === "7d") {
      // Last 7 days
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      granularity = "day";
      dateFormat = "%Y-%m-%d"; // Groups readings by day
    } else {
      // Default to 24h
      // Last 24 hours
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      granularity = "hour";
      dateFormat = "%Y-%m-%dT%H"; // Groups readings by hour
    }

    const trendData = await TelemetryReading.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime }, // Filter data by the time window
          unit: unitType, // Filter for the dynamic unit type requested by the user
        },
      },
      {
        $group: {
          // Create an ID based on the formatted date string (hour or day)
          _id: {
            $dateToString: {
              format: dateFormat,
              date: "$timestamp",
            },
          },
          totalSum: { $sum: "$reading" }, // Sum of readings (generic accumulator)
        },
      },
      {
        $sort: { _id: 1 }, // Sort results chronologically for the chart
      },
      // Dynamic projection logic: only convert to kWh if the base unit is 'W'
      {
        $project: {
          _id: 0,
          timeLabel: "$_id",
          // If unit is 'W', convert to kWh (dividing by 1000) and name the field 'usageKWh'.
          // Otherwise, just use the raw sum and name the field 'totalReading'.
          ...(unitType === "W"
            ? { usageKWh: { $divide: ["$totalSum", 1000] } }
            : { totalReading: "$totalSum" }),
        },
      },
    ]);

    // Determine the unit label for the frontend based on the type of aggregation
    const responseUnit = unitType === "W" ? "kWh" : unitType;

    res.status(200).json({
      window: window, // Use the normalized window value
      unit: responseUnit, // The unit to display (e.g., 'kWh', 'V', or 'C')
      dataKey: unitType === "W" ? "usageKWh" : "totalReading", // Key the frontend should read
      granularity: granularity,
      data: trendData,
    });
  } catch (error) {
    console.error("Error fetching telemetry trends:", error);
    res.status(500).json({
      // unitType is now accessible here
      message: `Failed to calculate trends for unit ${unitType}`,
      error: (error as Error).message,
    });
  }
};

// Calculates usage breakdown by Room (location) or Device Type (category).

export const getUsageBreakdown = async (req: Request, res: Response) => {
  try {
    // Determine the field to group by: 'deviceType' or 'location' (default)
    // 'category' maps to 'deviceType'
    const groupBy = req.query.by === "category" ? "deviceType" : "location";

    // Calculate the timestamp for 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pipeline = [
      // 1. Filter: Match recent energy usage readings (W) within the 7-day window
      {
        $match: {
          timestamp: { $gte: sevenDaysAgo },
          unit: "W", // Filter for Watt readings (consumption rate)
        },
      },

      // 2. Group: Group directly by the chosen field (location or deviceType)
      {
        $group: {
          _id: {
            // Group by the field present on the document itself
            // Uses $ifNull to handle potentially missing fields gracefully
            $ifNull: [`$${groupBy}`, "UNKNOWN_OR_MISSING_FIELD"],
          },
          totalWh: { $sum: "$reading" }, // Sum the readings (Watt-hours)
        },
      },

      // 3. Project: Format the output and convert Wh to kWh
      {
        $project: {
          _id: 0,
          name: "$_id", // The group name (e.g., 'Kitchen' or 'smart_plug')
          // Convert total Watt-hours to Kilowatt-hours (1 kWh = 1000 Wh)
          value: { $divide: ["$totalWh", 1000] },
        },
      },

      // 4. Final Filter: Remove groups that resulted from missing data links
      {
        $match: {
          name: { $nin: ["UNKNOWN_OR_MISSING_FIELD", null] },
        },
      },
    ];

    // CRITICAL: Cast the pipeline to 'any[]' to bypass the Mongoose/TypeScript type error
    // with dynamic aggregation stages.
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

// Retrieves a paginated list of device metadata.
export const getDeviceList = async (req: Request, res: Response) => {
  try {
    // --- 1. Extract and Validate Params ---
    const page = parseInt(extractString(req.query.page, "1"));
    const limit = parseInt(extractString(req.query.limit, "20"));
    // NEW: Extract the search term (optional)
    const search = extractString(req.query.search, "");

    // Define allowed sort fields and map the client-facing name to the MongoDB field name
    const sortFieldMap: { [key: string]: string } = {
      deviceId: "name", // Maps the displayed ID to the 'name' field in DeviceMetadata
      location: "location",
      deviceType: "deviceType",
      lastReported: "lastReported",
      status: "status",
    };

    const sortBy = extractString(req.query.sort, "lastReported");
    // Fallback to 'lastReported' if the requested sort field is invalid
    const sortMongoField = sortFieldMap[sortBy] || "lastReported";

    const order = extractString(req.query.order, "desc");
    const sortOrder = order === "asc" ? 1 : -1; // Mongoose sort order

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res
        .status(400)
        .json({ message: "Invalid pagination parameters." });
    }

    // --- 2. Construct Search Filter ---
    const filterQuery: any = {};

    if (search) {
      // Create the reusable MongoDB regex object for case-insensitive search
      const searchRegex = { $regex: search, $options: "i" };

      // Use $or to search across multiple fields: name (deviceId) OR deviceType
      filterQuery.$or = [
        { name: searchRegex }, // Matches on device ID
        { deviceType: searchRegex }, // Matches on device Type
      ];
    }

    // --- 3. Calculate Pagination (using the filterQuery) ---
    // totalDevices now counts documents matching the search filter
    const totalDevices = await DeviceMetadata.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalDevices / limit);
    const skip = (page - 1) * limit;

    // Ensure page requested is not out of bounds
    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({ message: `Page ${page} does not exist.` });
    }

    // --- 4. Database Query (using the filterQuery) ---
    // Use .lean() for faster query results since we don't need Mongoose Document methods
    const devices = await DeviceMetadata.find(filterQuery)
      .sort({ [sortMongoField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // --- 5. Format Response ---
    const formattedDevices = devices.map((device) => ({
      deviceId: device.name, // The unique device ID used across the frontend
      location: device.location,
      deviceType: device.deviceType,
      status: device.status,
      // Convert the date object to ISO string for consistent transport
      lastReported:
        device.lastReported instanceof Date
          ? device.lastReported.toISOString()
          : device.lastReported,
    }));

    // --- 6. Return Data ---
    res.status(200).json({
      status: "success",
      data: {
        devices: formattedDevices,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalDevices: totalDevices, // This is the total count of filtered devices
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

// Retrieves a paginated list of all telemetry readings with search (ID, Type, Location) and time-range filtering.
export const getTelemetryReadings = async (req: Request, res: Response) => {
  try {
    // --- 1. Extract and Validate Params ---
    const page = parseInt(extractString(req.query.page, "1"));
    const limit = parseInt(extractString(req.query.limit, "20"));

    // General search term across device ID, type, and location
    const search = extractString(req.query.search, "");

    // Timestamp filters
    const startTimestampStr = extractString(req.query.startTimestamp, "");
    const endTimestampStr = extractString(req.query.endTimestamp, "");

    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res
        .status(400)
        .json({ message: "Invalid pagination parameters." });
    }

    // --- 2. Construct Filter Query ---
    const filterQuery: any = {};

    // 2a. Add General Search Filter (across deviceId, deviceType, location)
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };

      // Use $or to search across the three requested fields
      filterQuery.$or = [
        { deviceId: searchRegex },
        { deviceType: searchRegex },
        { location: searchRegex },
      ];
    }

    // 2b. Add Timestamp Range Filter
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

    // --- 3. Calculate Pagination ---
    const totalReadings = await TelemetryReading.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalReadings / limit);
    const skip = (page - 1) * limit;

    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({ message: `Page ${page} does not exist.` });
    }

    // --- 4. Database Query ---
    // Sort by timestamp descending to show the newest readings first
    const readings = await TelemetryReading.find(filterQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // --- 5. Format and Return Data ---
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
