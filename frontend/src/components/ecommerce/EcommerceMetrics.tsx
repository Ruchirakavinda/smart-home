import React, {
  useState,
  useEffect,
  ReactElement,
  useCallback,
  useRef,
} from "react";

interface MetricsState {
  totalUsage: string | null;
  onlineDevices: number | null;
  totalDevices: number | null;
  highestReading: string | null;
}

interface TelemetryApiResponse {
  totalUsage: string;
  onlineDevices: number;
  totalDevices: number;
  highestReading: string;
}

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;

  icon: (props: { className: string }) => React.ReactElement;
  iconBgColor: string;
  iconColor: string;
  cardBorderColor?: string;
  badgeContent?: React.ReactNode;
}

type WsStatus = "connecting" | "open" | "closed" | "error";
type ApiStatus = "checking" | "online" | "offline";

const BACKEND_URL = "http://localhost:3001";
const HEALTH_API_PATH = "/health";

const AGGREGATE_API_PATH = "/telemetry/summary";

const WS_URL = "ws://localhost:3001/ws/telemetry";

const GroupIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h-4M7 20h4M17 10h-4M7 10h4M4 14V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2zM12 4v16M8 10h8"
    />
  </svg>
);
const BoxIconLine = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

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

const Badge2 = ({
  children,
  color = "success",
}: {
  children: React.ReactNode;
  color: "success" | "warning" | "error" | "primary";
}) => {
  let style = "bg-green-100 text-green-700 border-2 border-green-300";
  if (color === "error") style = "bg-red-100 text-red-700";
  if (color === "warning") style = "bg-yellow-100 text-yellow-700";
  if (color === "primary") style = "bg-indigo-100 text-indigo-700";

  return (
    <span
      className={`mx-3 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-medium ${style}`}
    >
      {children}
    </span>
  );
};

const useWebSocket = (url: string) => {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("open");
      console.log("WebSocket connection opened.");
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data);
    };

    ws.onerror = () => {
      console.error("WebSocket error occurred.");
      setWsStatus("error");
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
      setWsStatus("closed");

      setTimeout(() => {
        if (
          wsRef.current?.readyState === WebSocket.CLOSED ||
          wsRef.current?.readyState === WebSocket.CLOSING
        ) {
        }
      }, 5000);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setWsStatus("closed");
    };
  }, [url]);

  return { lastMessage, wsStatus };
};

const useApiHealth = (url: string, path: string) => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${url}${path}`);
      if (response.ok) {
        setApiStatus("online");
      } else {
        setApiStatus("offline");
      }
    } catch (error) {
      setApiStatus("offline");
      console.error("API Health Check Failed:", error);
    }
  }, [url, path]);

  useEffect(() => {
    checkHealth();

    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { apiStatus };
};

// --- Metric Card Component
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  iconBgColor,
  iconColor,
  badgeContent,
  cardBorderColor = "border-gray-200",
}) => {
  const isLoading = value === "--";

  return (
    <div
      className={`rounded-2xl border ${cardBorderColor} bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 shadow-lg hover:shadow-xl transition-shadow duration-300`}
    >
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBgColor}`}
      >
        <Icon className={`${iconColor} size-6 dark:text-white/90`} />
      </div>
      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {title}
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90 text-2xl">
            {isLoading && title !== "Current Power Draw" ? (
              <div className="h-7 w-24 bg-gray-200 animate-pulse rounded my-1"></div>
            ) : (
              <>
                {value}
                {unit && (
                  <span className="ml-1 text-base font-normal text-gray-500">
                    {unit}
                  </span>
                )}
              </>
            )}
          </h4>
        </div>
        {badgeContent}
      </div>
    </div>
  );
};

export default function TelemetryMetrics() {
  const [currentPower, setCurrentPower] = useState<number | null>(null);
  const { lastMessage, wsStatus } = useWebSocket(WS_URL);

  const { apiStatus } = useApiHealth(BACKEND_URL, HEALTH_API_PATH);

  const [metrics, setMetrics] = useState<MetricsState>({
    totalUsage: null,
    onlineDevices: null,
    totalDevices: null,
    highestReading: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data: { reading?: number } = JSON.parse(lastMessage);
        if (data.reading !== undefined) {
          setCurrentPower(data.reading);
        }
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    }
  }, [lastMessage]);

  const fetchAggregateMetrics = useCallback(async () => {
    setIsLoading(true);
    const apiUrl = `${BACKEND_URL}${AGGREGATE_API_PATH}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      const data: TelemetryApiResponse = await response.json();

      setMetrics({
        ...data,
        totalUsage: parseFloat(data.totalUsage).toFixed(2),
        highestReading: parseFloat(data.highestReading).toFixed(1),
      });
    } catch (error) {
      console.error("Failed to fetch aggregate metrics:", error);
      setMetrics({
        totalUsage: "--",
        onlineDevices: 0,
        totalDevices: 0,
        highestReading: "--",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAggregateMetrics();
    const interval = setInterval(fetchAggregateMetrics, 60000);
    return () => clearInterval(interval);
  }, [fetchAggregateMetrics]);

  const LiveStatusBadge = (): ReactElement => {
    const wsText =
      wsStatus === "open"
        ? "Live Stream"
        : wsStatus === "connecting"
        ? "WS Connecting"
        : "WS Down";

    let color: "success" | "warning" | "error" | "primary";

    if (wsStatus === "open") {
      color = "primary";
    } else if (wsStatus === "closed") {
      color = "error";
    } else {
      color = "warning";
    }

    return <Badge color={color}>{wsText} </Badge>;
  };

  const HealthStatusBadge = (): ReactElement => {
    const apiText =
      apiStatus === "online"
        ? "Online"
        : apiStatus === "checking"
        ? "Checking"
        : "Offline";

    let color: "success" | "warning" | "error" | "primary";

    if (apiStatus === "online") {
      color = "success";
    } else if (apiStatus === "offline") {
      color = "error";
    } else {
      color = "warning";
    }

    return <Badge2 color={color}> {apiText}</Badge2>;
  };

  const devicesValue: string = `${
    metrics.onlineDevices !== null ? metrics.onlineDevices : "--"
  } / ${metrics.totalDevices !== null ? metrics.totalDevices : "--"}`;
  const powerValue: string =
    currentPower !== null ? currentPower.toFixed(2) : "--";
  const usageValue: string =
    metrics.totalUsage !== null ? metrics.totalUsage : "--";
  const peakValue: string =
    metrics.highestReading !== null ? metrics.highestReading : "--";

  return (
    <div>
      <div className="flex flex-col gap-5 mb-10 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Real-Time Energy Dashboard <HealthStatusBadge />
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
        <MetricCard
          title="Current Power Draw"
          value={powerValue}
          unit="W"
          icon={BoxIconLine}
          iconBgColor="bg-indigo-100 dark:bg-indigo-800"
          iconColor="text-indigo-600"
          cardBorderColor="border-indigo-200"
          badgeContent={<LiveStatusBadge />}
        />

        <MetricCard
          title="Active Devices"
          value={devicesValue}
          unit=""
          icon={GroupIcon}
          iconBgColor="bg-blue-100 dark:bg-blue-800"
          iconColor="text-blue-600"
          badgeContent={<Badge color="success">Operational</Badge>}
        />

        <MetricCard
          title="Today's Usage"
          value={usageValue}
          unit="kWh"
          icon={BoxIconLine}
          iconBgColor="bg-green-100 dark:bg-green-800"
          iconColor="text-green-600"
        />

        <MetricCard
          title="Highest Peak Load"
          value={peakValue}
          unit="W"
          icon={BoxIconLine}
          iconBgColor="bg-yellow-100 dark:bg-yellow-800"
          iconColor="text-yellow-600"
        />
      </div>
    </div>
  );
}
