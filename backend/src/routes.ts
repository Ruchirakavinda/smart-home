// backend/src/routes.ts
import { Router } from "express";
import {
  getEnergyTrends,
  getHealthStatus,
  getTelemetrySummary,
  getUsageBreakdown,
  ingestTelemetry,
} from "./controllers/TelemetryController";

const router = Router();

// LIVENESS INDICATOR
router.get("/health", getHealthStatus);

// CORE TELEMETRY INGESTION
router.post("/devices/ingest", ingestTelemetry);

// Key Metrics Summary 
router.get('/telemetry/summary', getTelemetrySummary);
export default router;

//  Telemetry Trends 
router.get('/telemetry/trends/total', getEnergyTrends);

// Usage Breakdown
router.get('/telemetry/breakdown', getUsageBreakdown);