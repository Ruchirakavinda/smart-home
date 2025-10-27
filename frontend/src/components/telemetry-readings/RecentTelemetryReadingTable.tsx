import React, { useEffect, useState, useRef, ReactElement } from "react";
import { useNavigate } from "react-router";

const Badge = ({
  children,
  color = "success",
}: {
  children: React.ReactNode;
  color: "success" | "warning" | "error" | "primary";
}) => {
  let style = "bg-green-100 text-green-700";

  if (color === "error") style = "bg-red-100 text-red-700";
  if (color === "warning") style = "bg-yellow-100 text-yellow-700";
  if (color === "primary") style = "bg-indigo-100 text-indigo-700";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style}`}
    >
      {children}
    </span>
  );
};

type WsStatus = "connecting" | "open" | "closed" | "error";

const useWebSocket = (url: string) => {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("open");
    ws.onmessage = (event) => setLastMessage(event.data);
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => setWsStatus("closed");

    return () => ws.close();
  }, [url]);

  return { lastMessage, wsStatus };
};

interface TelemetryReading {
  _id: string;
  deviceId: string;
  timestamp: string;
  reading: number;
  unit: string;
  location: string;
  deviceType: string;
}

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const READINGS_API_URL =
  BACKEND_BASE_URL + import.meta.env.VITE_READINGS_API_PATH;
const WS_URL = import.meta.env.VITE_WS_URL;

export default function RecentTelemetryReadingTable() {
  const navigate = useNavigate();
  const { lastMessage, wsStatus } = useWebSocket(WS_URL);

  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReadings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${READINGS_API_URL}?page=1&limit=10`);
        const json = await res.json();
        setReadings(json?.data?.readings || []);
      } catch (err) {
        console.error("Fetch error:", err);
        setReadings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReadings();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const newReading: TelemetryReading = JSON.parse(lastMessage);
      setReadings((prev) => {
        if (prev.some((r) => r._id === newReading._id)) return prev;
        return [newReading, ...prev].slice(0, 50);
      });
    } catch (e) {
      console.error("Failed to parse WS message:", e);
    }
  }, [lastMessage]);

  const formatTimestamp = (isoString: string) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid Date";

    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
      date.getUTCDate()
    ).padStart(2, "0")}/${date.getUTCFullYear()}, ${String(
      date.getUTCHours()
    ).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(
      2,
      "0"
    )}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
  };

  // --- Live Status Badge ---
  const LiveStatusBadge = (): ReactElement => {
    let color: "success" | "warning" | "error" | "primary";
    let text =
      wsStatus === "open"
        ? "Live Stream"
        : wsStatus === "connecting"
        ? "Connecting"
        : "Down";

    color =
      wsStatus === "open"
        ? "primary"
        : wsStatus === "closed"
        ? "error"
        : "warning";

    return <Badge color={color}>{text}</Badge>;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Recent Telemetry Readings
          </h3>
          <LiveStatusBadge />
        </div>

        <div>
          <button
            onClick={() => navigate("/telemetry-readings")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
          >
            See All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
            <p className="text-sm text-gray-500 mt-2">
              Loading historical data...
            </p>
          </div>
        ) : readings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-gray-400">
              No telemetry readings found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05]">
              <thead className="bg-gray-50 dark:bg-white/[0.03]">
                <tr>
                  <th className="px-5 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Timestamp
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Device ID
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Location
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Device Type
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                    Reading
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {readings.map((r) => (
                  <tr
                    key={r._id}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4 text-sm text-gray-800 dark:text-white/90 font-semibold whitespace-nowrap">
                      {formatTimestamp(r.timestamp)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {r.deviceId}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {r.location}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {r.deviceType}
                    </td>
                    <td className="px-5 py-4 text-sm text-blue-500 font-semibold  font-mono">
                      {r.reading.toFixed(2)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
