## Smart Home Energy Monitor: Event-Driven Telemetry System

1. Project Overview & Scenario Context

# This project delivers a complete, full-stack system designed to monitor energy consumption from smart home devices (plugs, lights, thermostats). The system handles event-driven telemetry ingestion and provides a near real-time dashboard for visualizing household power usage trends and device-level activity.

The solution is built with production habits in mind, including full containerization, strong TypeScript typing, unit testing for both the backend and frontend, and clear documentation of design trade-offs.

2. Setup and Run Instructions

The entire system is containerized using Docker Compose, allowing for single-command deployment of the full application stack (Frontend, Backend API, and Database).

Prerequisites

Docker and Docker Compose (or Docker Desktop)

Node.js (for non-Docker development only)

Containerized Setup (Recommended)

Environment Variables: Create copies of the provided environment examples in the respective service directories and fill them out with secure values:

Copy backend/.env.example to backend/.env

Copy frontend/.env.example to frontend/.env

Build and Run: Execute the following command from the project root directory:

docker compose up --build


This command will build the frontend and backend images, provision the MongoDB container, and start all services.

Access:

Frontend Dashboard: Available at http://localhost:3000

Backend API (Health Check): Available at http://localhost:8080/health

Non-Docker Development Setup (Optional)

Start Database: Ensure a local or containerized MongoDB instance is running.

Backend Setup (./backend):

npm install
npm run dev  # Starts the Node.js/Express server (http://localhost:8080)


Frontend Setup (./frontend):

npm install
npm run dev  # Starts the Vite development server (http://localhost:3000)


3. Testing Instructions

Unit tests are implemented for both the core API logic (Backend) and critical data-handling components (Frontend).

Backend Testing (Node.js/Jest)

Tests cover API ingestion and query logic (success and failure paths).

cd backend
npm test


Frontend Testing (React/Vitest)

Tests cover components responsible for fetching data and managing display state.

cd frontend
npm test


4. API Reference (Minimal Surface)

The backend API is implemented using Node.js/Express.

Endpoint: GET /health

Description: Liveness check for operational monitoring.

Response Summary: 200 OK

Endpoint: POST /api/v1/devices/ingest

Description: Accepts single or batched telemetry readings for persistence.

Request Summary: JSON array of readings.

Response Summary: 201 Created with summary of successful/failed ingests.

Endpoint: GET /api/v1/devices/readings

Description: Queries stored telemetry data with basic filtering and pagination.

Query Params: deviceId, startTime, endTime, limit, page.

Response Summary: JSON array of readings and pagination metadata.

Endpoint: GET /api/v1/devices/metrics

Description: Calculates and returns aggregated metrics (e.g., total energy usage trend).

Query Params: duration (e.g., '1h', '24h').

Response Summary: JSON object with aggregated metrics.

5. Architecture Notes & Key Decisions

High-Level Design and Data Flow

The system uses a classic Three-Tier Architecture centered around high I/O throughput:

Client (React/TypeScript): Visualization tier, uses client-side polling to retrieve updates.

API/Application (Node.js/Express/TypeScript): Handles routing, request validation, business logic, and interaction with the database.

Data Layer (MongoDB): Durable and flexible storage for raw telemetry readings.

Data Flow Summary: Device (POST) → API Validation → Persistence (MongoDB) → Frontend Polling → API Aggregation → Frontend Rendering.

Key Decisions and Trade-Offs

Decision 1: Database - MongoDB (NoSQL)

Justification: Best suited for heterogeneous, time-series telemetry data where the schema is likely to evolve quickly (e.g., a new device sends a new metric).

Trade-Off: Reduced transactional integrity compared to PostgreSQL; aggregation can be resource-intensive without proper indexing.

Decision 2: Backend - Node.js/Express

Justification: Provides high-performance, non-blocking I/O, crucial for a high-volume data ingestion API. Express is minimalist, preventing excessive boilerplate.

Trade-Off: Requires more manual implementation of common features (e.g., strong validation, caching) compared to an opinionated full-stack framework.

Decision 3: Real-Time Updates - Polling

Justification: Minimal Viable Product (MVP) choice. Quick to implement and satisfies the functional requirement for UI updates.

Trade-Off: Inefficient and high-latency. This must be replaced with a push mechanism (WebSockets) for production use.

Decision 4: Frontend Testing - Vitest

Justification: Superior integration and significantly faster test execution times within the Vite build environment compared to a standard Jest setup.

Trade-Off: Requires specific configuration setup in the Vite environment.

Environment Variables and Security

Configuration is strictly separated using .env files for each service. All database credentials and sensitive paths are managed through these files and are kept outside the code base. Internal communication relies on Docker's built-in networking for service name resolution.

6. Assumptions and Limitations

All Assumptions Made During Implementation

Backend Framework: Express.js was chosen to minimize boilerplate and focus on core API logic.

Telemetry Model: All device data is modeled under a unified Telemetry collection/schema in MongoDB, using fields like deviceType and readingType for internal differentiation.

Timezone Standard: All timestamps (timestamp, startTime, endTime) are assumed to be handled in UTC internally to prevent timezone ambiguity.

Validation: Basic validation (type checking, presence of mandatory fields) is implemented in the API.

Known Limitations

Real-Time Updates: Real-time functionality is currently implemented using basic client-side polling (every ~5 seconds).

Authentication: No user authentication or authorization is implemented. The API is openly accessible within the Docker network.

Rate Limiting: No API rate limiting is applied to the ingestion or query endpoints, which would be essential for preventing abuse in a public deployment.

Error Persistence: Telemetry records that fail validation are currently discarded, with only a count of failures returned.

7. Project TODOs and Future Improvements

MUST (Priority 1: Required for Production Readiness)

[MUST] WebSockets Implementation: Replace the polling mechanism with a WebSocket (e.g., Socket.IO) connection for true real-time data push from the backend.

[MUST] Ingestion Failure Handling: Implement a Dead-Letter Queue (DLQ) to store and retry telemetry records that fail validation or persistence.

[MUST] Detailed Logging: Enhance logging to include detailed request payloads, error stack traces, and database query timings for troubleshooting.

[MUST] Pagination Sanity Checks: Add strict validation for page and limit query parameters.

SHOULD (Priority 2: Major Feature Improvements)

[SHOULD] User Authentication: Implement basic user login (e.g., JWT) to secure API endpoints.

[SHOULD] Device Configuration Service: Add a new API to manage device metadata (e.g., room, capacity, last maintenance).

[SHOULD] Optimized Metrics Query: Refactor metric aggregation queries to leverage MongoDB's time-series capabilities or use a dedicated time-series solution for performance.

[SHOULD] Filtering on Frontend: Add a date/time range picker to the dashboard UI for flexible querying.

NICE-TO-HAVE (Priority 3: Polish and Future Work)

[NICE-TO-HAVE] Advanced Charting: Implement complex visualizations such as device comparison charts and moving averages.

[NICE-TO-HAVE] API Documentation (Swagger): Integrate an OpenAPI/Swagger tool into the backend for automatically generated documentation.

[NICE-TO-HAVE] Theming/Dark Mode: Implement a toggle switch in the React frontend.