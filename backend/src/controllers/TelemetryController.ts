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

export const getEnergyTrends = async (req: Request, res: Response) => {
    // FIX: Declare unitType and window outside the try block so they are accessible 
    // in the catch block for error logging.
    let unitType: string = 'W'; 
    let window: string = '24h'; 

    try {
        // Helper function to safely extract the first string value from a query parameter,
        // preventing 'ParsedQs' objects from being assigned to a simple string type.
        const extractString = (param: any, defaultValue: string): string => {
            if (typeof param === 'string') {
                return param;
            }
            // Check if it's an array and the first element is a string
            if (Array.isArray(param) && typeof param[0] === 'string') {
                return param[0];
            }
            // If it's undefined, an object (ParsedQs), or anything else, use the default.
            return defaultValue;
        };

        // Retrieve and normalize query parameters (safely extracting string values)
        window = extractString(req.query.window, '24h');
        unitType = extractString(req.query.unitType, 'W');

        let startTime: Date;
        let granularity: 'day' | 'hour';
        let dateFormat: string;

        if (window === '7d') {
            // Last 7 days
            startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            granularity = 'day';
            dateFormat = '%Y-%m-%d'; // Groups readings by day
        } else { // Default to 24h
            // Last 24 hours
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            granularity = 'hour';
            dateFormat = '%Y-%m-%dT%H'; // Groups readings by hour
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
                    ...(unitType === 'W' 
                        ? { usageKWh: { $divide: ["$totalSum", 1000] } }
                        : { totalReading: "$totalSum" }
                    ),
                },
            },
        ]);

        // Determine the unit label for the frontend based on the type of aggregation
        const responseUnit = unitType === 'W' ? 'kWh' : unitType; 

        res.status(200).json({
            window: window, // Use the normalized window value
            unit: responseUnit, // The unit to display (e.g., 'kWh', 'V', or 'C')
            dataKey: unitType === 'W' ? 'usageKWh' : 'totalReading', // Key the frontend should read
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

/**
 * Calculates usage breakdown by Room (location) or Device Type (category).
 * Time frame is the last 7 days.
 * @route GET /breakdown
 * @queryParam by - 'location' (default) or 'category'
 */
export const getUsageBreakdown = async (req: Request, res: Response) => {
    try {
        // Determine the field to group by: 'deviceType' or 'location' (default)
        // 'category' maps to 'deviceType'
        const groupBy = req.query.by === 'category' ? 'deviceType' : 'location';
        
        // Calculate the timestamp for 7 days ago
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const pipeline = [
            // 1. Filter: Match recent energy usage readings (W) within the 7-day window
            {
                $match: {
                    timestamp: { $gte: sevenDaysAgo },
                    unit: 'W' // Filter for Watt readings (consumption rate)
                }
            },
            
            // 2. Group: Group directly by the chosen field (location or deviceType)
            {
                $group: {
                    _id: { 
                        // Group by the field present on the document itself
                        // Uses $ifNull to handle potentially missing fields gracefully
                        $ifNull: [`$${groupBy}`, 'UNKNOWN_OR_MISSING_FIELD'] 
                    },
                    totalWh: { $sum: '$reading' } // Sum the readings (Watt-hours)
                }
            },
            
            // 3. Project: Format the output and convert Wh to kWh
            {
                $project: {
                    _id: 0,
                    name: '$_id', // The group name (e.g., 'Kitchen' or 'smart_plug')
                    // Convert total Watt-hours to Kilowatt-hours (1 kWh = 1000 Wh)
                    value: { $divide: ['$totalWh', 1000] } 
                }
            },
            
            // 4. Final Filter: Remove groups that resulted from missing data links
            {
                $match: {
                    name: { $nin: ['UNKNOWN_OR_MISSING_FIELD', null] }
                }
            }
        ];
        
        // CRITICAL: Cast the pipeline to 'any[]' to bypass the Mongoose/TypeScript type error 
        // with dynamic aggregation stages.
        const breakdownData = await TelemetryReading.aggregate(pipeline as any[]);

        res.status(200).json({
            groupBy: groupBy,
            unit: 'kWh',
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