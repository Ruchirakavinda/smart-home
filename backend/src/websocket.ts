import WebSocket, { Server } from 'ws';
import { Server as HttpServer } from 'http';
import { ITelemetryReading } from './models/TelemetryReading';

let wss: Server | null = null;

/**
 * Initializes the WebSocket Server and attaches it to the existing HTTP server.
 * All clients connect to ws://localhost:3001/ws/telemetry
 */
export const initWebSocket = (server: HttpServer) => {
    // Initialize WebSocket server on the /ws/telemetry path
    wss = new Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        // Only handle requests for the /ws/telemetry path
        if (request.url === '/ws/telemetry') {
            wss!.handleUpgrade(request, socket, head, (ws) => {
                wss!.emit('connection', ws, request);
            });
        } else {
            socket.destroy(); // Reject other upgrade requests
        }
    });

    wss.on('connection', (ws) => {
        console.log('WebSocket client connected to /ws/telemetry');
        
        ws.on('close', () => {
            console.log('WebSocket client disconnected');
        });
        
        // Optionally handle incoming messages if the client sends data
        // ws.on('message', (message) => { ... });
    });

    console.log('WebSocket server initialized on /ws/telemetry');
};

/**
 * Broadcasts a new telemetry reading to all connected WebSocket clients.
 * This is used by the TelemetryController's ingest function.
 */
export const broadcastNewReading = (reading: ITelemetryReading) => {
    if (!wss) {
        console.warn('WebSocket server not initialized. Cannot broadcast.');
        return;
    }

    const data = JSON.stringify(reading);

    // Send the data to every client whose connection is open
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};
