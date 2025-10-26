// backend/src/routes.ts
import { Router } from "express";
import {
  getHealthStatus,
  getTelemetrySummary,
  ingestTelemetry,
} from "./controllers/TelemetryController";

const router = Router();

// LIVENESS INDICATOR
router.get("/health", getHealthStatus);

// CORE TELEMETRY INGESTION
router.post("/api/v1/devices/ingest", ingestTelemetry);

// 2. Key Metrics Summary 
router.get('/telemetry/summary', getTelemetrySummary);
export default router;
