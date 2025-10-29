# Smart Home Energy Monitor: Event-Driven Telemetry System

# 1. Project Overview & Scenario Context

This project delivers a complete system designed to monitor energy consumption from smart home devices (plugs, lights, thermostats). The system handles event-driven telemetry ingestion and provides a near real-time dashboard for visualizing household power usage trends and device-level activity.

# 2. Setup and Run Instructions

The entire system is containerized using Docker Compose, allowing for single-command deployment of the full application stack (Frontend, Backend API, and Database).

## Prerequisites

Docker and Docker Compose (or Docker Desktop)

Node.js (for non-Docker development only)

## Containerized Setup 

Environment Variables: Create copies of the provided environment examples in the respective service directories and fill them out with secure values:

Copy ## smart-home/.env.example to ## smart-home/.env

Copy ## backend/.env.example to ## backend/.env

Copy ## frontend/.env.example to ## frontend/.env

## Build and Run: Execute the following command from the project root directory:

docker compose up --build


This command will build the frontend and backend images, provision the MongoDB container, and start all services.

Access:

Frontend Dashboard: Available at http://localhost:80

Backend API (ex: Health Check): Available at http://localhost:3001/health

## Local Development / Non-Docker Development

Start Database:

 compose up mongo : MongoDB runs in Docker docker

Backend Setup (./backend):

npm install
npm run dev  : Starts the Node.js/Express server (http://localhost:3001)


Frontend Setup (./frontend):

npm install
npm run dev  : Starts the Vite development server (http://localhost:5173)


# 3. Testing Instructions

Unit tests are implemented for both the Backend and Frontend.

## Backend Testing (Node.js/Jest)

cd backend
npm test


## Frontend Testing (React/Jest)

cd frontend
npm test


# 4. API Reference 

The backend API is implemented using Node.js with TypeScript.

## Endpoint - GET: http://localhost:3001/health

Description: Liveness check for operational monitoring.

Response Summary: 200 OK

## Endpoint - POST:  http://localhost:3001/devices/ingest

Description: Accepts single or batched telemetry readings for persistence.

Request Body :
[
{
  "deviceId": "plug-kitchen-20",
  "timestamp": "2025-10-26T14:30:00.000Z",
  "reading": 155.75,
  "location": "Kitchen",
  "deviceType": "smart_plug"
},
{...}
]

Request Summary:
{
    "message": "Telemetry accepted and processed.",
    "count": 1
}



## Endpoint - GET : http://localhost:3001/telemetry/readings

example query params : 
page=1
limit=20
search=plug
startTimestamp=2025-10-07T00:09:42.000Z
endTimestamp=2025-10-14T00:09:44.000Z

Description: Queries stored telemetry data with basic filtering and pagination.

Response Summary: JSON array of readings and pagination metadata.

{
    "status": "success",
    "data": {
        "readings": [
            {
                "_id": "690102718135293faa225a44",
                "deviceId": "plug-room-6",
                "timestamp": "2025-10-28T23:20:00.000Z",
                "reading": 105,
                "unit": "W",
                "location": "Guest Bed Room 2",
                "deviceType": "smart_plug",
                "__v": 0
            },
        ],
        "pagination": {
            "currentPage": 1,
            "totalPages": 7,
            "totalReadings": 126,
            "limit": 20
        }
    }

## Endpoint - GET : http://localhost:3001/telemetry/summary

Description: Calculates and returns aggregated summery 

Response Summary: JSON object with aggregated summery (e.g., Active Devices, Today's Usage, Highest Peak Load).

{
    "totalUsage": "40214.57",
    "onlineDevices": 1,
    "totalDevices": 20,
    "highestReading": "20056464.0",
    "unit": {
        "totalUsage": "kWh",
        "highestReading": "W"
    },
    "timestamp": "2025-10-28T18:49:36.854Z"
}

## Endpoint - GET : http://localhost:3001/telemetry/trends/total

Query Params: window= (7d or 24h)

Description: Calculates Energy Usage Trend (Last 7 Days or last 24 hours)

Response Summary: JSON object with Calculated Energy Usage Trend for Bar Chart.

{
    "window": "7d",
    "unit": "kWh",
    "dataKey": "usageKWh",
    "granularity": "day",
    "data": [
        {
            "timeLabel": "2025-10-25",
            "usageKWh": 0.3415
        },
        {
            "timeLabel": "2025-10-26",
            "usageKWh": 89.24925
        },    ]
}


## Endpoint - GET : http://localhost:3001/telemetry/breakdown

Query Params: by= (category or location)

Description: Energy Usage Breakdown (By Location or Category)

Response Summary: JSON object with Calculated Energy Usage Breakdown for Breakdown chart.
{
    "groupBy": "location",
    "unit": "kWh",
    "data": [
        {
            "name": "Bed Room",
            "value": 40214.259
        },
        {
            "name": "Guest Bed Room 2",
            "value": 0.105
        },
    ]
}


## Endpoint - GET : http://localhost:3001/telemetry/metadata/devices

example query params : 
page=1
limit=20
search=smart

Description: All Devices Metadata

Response Summary: JSON object with all devices metadata.
{
    "status": "success",
    "data": {
        "devices": [
            {
                "deviceId": "plug-room-6",
                "location": "Guest Bed Room 2",
                "deviceType": "smart_plug",
                "status": "online",
                "lastReported": "2025-10-28T23:20:00.000Z"
            },
        ],
        "pagination": {
            "currentPage": 1,
            "totalPages": 2,
            "totalDevices": 20,
            "limit": 10
        }
    }
}


# 5. Architecture Notes & Key Decisions

## High-Level Design and Data Flow

The system uses a classic Three-Tier Architecture centered around high I/O throughput:

Client (React/TypeScript): Visualization tier, uses WebSocket to retrieve real-time updates. (Current Power Draw , Recent/All Telemetry Readings). And Meaning full Charts and metrics.

API/Application (Node.js/TypeScript): Handles routing, request validation, business logic, and interaction with the database and client.

Data Layer (MongoDB): Durable and flexible storage for raw telemetry readings.

## Data Flow Summary: Device (POST) → API Validation → Persistence (MongoDB) → API Aggregation → Frontend Rendering.

## Key Decisions and Trade-Offs

## Decision 1: Database - MongoDB (NoSQL)

Justification: Best suited for diverse, time-series telemetry data where the schema is likely to evolve quickly (e.g., a new device sends a new metric).

Trade-Off: Reduced transactional integrity compared to PostgreSQL; aggregation can be resource-intensive without proper indexing.

## Decision 2: Backend - Node.js/Express

Justification: Provides high-performance, non-blocking I/O, crucial for a high-volume data ingestion API. Express is minimalist, preventing excessive boilerplate.

Trade-Off: Requires more manual implementation of common features (e.g., strong validation, caching) compared to an opinionated full-stack framework.

## Decision 3: Real-Time Updates - WebSockets (Socket.IO)
ustification: Provides a low-latency, event-driven push mechanism for instant dashboard updates. This is crucial for a real-time monitoring application and avoids the inefficiency of client-side polling.

Trade-Off: Increases complexity in backend connection management and requires persistent connections, which consume slightly more server resources than simple stateless HTTP polling.


## Environment Variables and Security

Configuration is strictly separated using .env files for each service. All database credentials and sensitive paths are managed through these files and are kept outside the code base. Internal communication relies on Docker's built-in networking.

# 6. Assumptions and Limitations

## All Assumptions Made During Implementation

Backend Framework: Express.js was chosen to minimize boilerplate and focus on core API logic.

Telemetry Model: All device data is modeled under a unified Telemetry collection/schema in MongoDB, using fields like deviceType and readingType for internal differentiation.

Validation: Basic validation (type checking, presence of mandatory fields) is implemented in the API and used Formik Validation for frontend Form Validations

## Known Limitations
Data Ingestion Source: For simplicity, testing, and ease of demonstration, telemetry data is currently entered and submitted via a frontend form. In a real-life scenario, this data would be directly injected/streamed from physical smart devices using a suitable tech directly calling the ingestion API.

Power Measurement Unit: The system currently relies exclusively on Watts (W) as the unit for power readings. Support for other relevant units (e.g., kWh for billing, Volts, Amps) is not yet implemented.

Authentication: No user authentication or authorization is implemented. The API is openly accessible within the Docker network.

Rate Limiting: No API rate limiting is applied to the ingestion or query endpoints, which would be essential for preventing abuse in a public deployment.


# 7. Project TODOs and Future Improvements

## MUST 

[MUST] Data Ingestion Source: telemetry data would be directly injected/streamed from physical smart devices using a suitable tech directly calling the ingestion API.

[MUST] Ingestion Failure Handling: Implement a way to store and retry telemetry records that fail validation or persistence.

[MUST] Detailed Logging: Enhance logging to include detailed request payloads, error stack traces, and database query timings for troubleshooting.

[MUST] Pagination Sanity Checks: Add strict validation for page and limit query parameters.

## SHOULD 

[SHOULD] Extend Measurement Units: Update the API and database schema to support and validate multiple power/energy measurement units (e.g., kWh, Volts).

[SHOULD] User Authentication: Implement basic user login to secure API endpoints.

[SHOULD] Device Configuration Service: Add a new API to manage device metadata (e.g., capacity, last maintenance).

[SHOULD] Optimized Metrics Query: Refactor metric aggregation queries to leverage DB's time-series capabilities or use a dedicated time-series solution for performance.

## NICE-TO-HAVE 

[NICE-TO-HAVE] Advanced Charting: Implement complex visualizations such as device comparison charts and moving averages.

[NICE-TO-HAVE] API Documentation (Swagger): Integrate an API Documentation tool into the backend for automatically generated documentation.
