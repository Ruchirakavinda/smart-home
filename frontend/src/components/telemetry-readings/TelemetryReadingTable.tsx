import { useEffect, useState, useRef, ReactElement } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

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
      className={`mx-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style}`}
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

export default function TelemetryReadingTable() {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [activeStartTime, setActiveStartTime] = useState("");
  const [activeEndTime, setActiveEndTime] = useState("");
  const [tempStartTime, setTempStartTime] = useState("");
  const [tempEndTime, setTempEndTime] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  const { lastMessage, wsStatus } = useWebSocket(WS_URL);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const formatTimestamp = (iso: string) => {
    if (!iso) return "N/A";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Invalid Date";
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(
      d.getUTCDate()
    ).padStart(2, "0")}/${d.getUTCFullYear()}, ${String(
      d.getUTCHours()
    ).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(
      d.getUTCSeconds()
    ).padStart(2, "0")}`;
  };

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

  const fetchReadings = async () => {
    setLoading(true);
    try {
      let url = `${READINGS_API_URL}?page=${page}&limit=20&search=${search}`;
      if (activeStartTime) url += `&startTimestamp=${activeStartTime}`;
      if (activeEndTime) url += `&endTimestamp=${activeEndTime}`;

      const res = await fetch(url);
      const json = await res.json();
      setReadings(json?.data?.readings || []);
      setTotalPages(json?.data?.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
      setReadings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadings();
  }, [page, search, activeStartTime, activeEndTime]);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const newReading: TelemetryReading = JSON.parse(lastMessage);
      setReadings((prev) => {
        if (prev.some((r) => r._id === newReading._id)) return prev;
        return [newReading, ...prev].slice(0, 50);
      });
    } catch (e) {
      console.error("WS parse error", e);
    }
  }, [lastMessage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleApplyFilter = () => {
    setActiveStartTime(tempStartTime);
    setActiveEndTime(tempEndTime);
    setPage(1);
  };

  const toDateTimeLocal = (iso: string) =>
    iso ? iso.slice(0, 19).replace("Z", "") : "";

  return (
    <div
      className={`rounded-2xl flex flex-col gap-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6`}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
          Telemetry Readings <LiveStatusBadge />
        </h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-xl  dark:bg-gray-800/50 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4 flex-grow">
          <div className="flex flex-col">
            <label
              htmlFor="start-date"
              className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Start Timestamp (UTC)
            </label>
            <input
              id="start-date"
              type="datetime-local"
              value={toDateTimeLocal(tempStartTime)}
              onChange={(e) => {
                const localTime = e.target.value;

                let formattedTime = localTime;
                if (formattedTime && formattedTime.length === 16) {
                  formattedTime += ":00";
                }
                setTempStartTime(formattedTime ? `${formattedTime}.000Z` : "");
              }}
              className="h-10 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-700/70 p-2 text-sm dark:text-white/90"
              step="1"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="end-date"
              className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              End Timestamp (UTC)
            </label>
            <input
              id="end-date"
              type="datetime-local"
              value={toDateTimeLocal(tempEndTime)}
              onChange={(e) => {
                const localTime = e.target.value;

                let formattedTime = localTime;
                if (formattedTime && formattedTime.length === 16) {
                  formattedTime += ":00";
                }
                setTempEndTime(formattedTime ? `${formattedTime}.000Z` : "");
              }}
              className="h-10 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-700/70 p-2 text-sm dark:text-white/90"
              step="1"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleApplyFilter}
            disabled={loading}
            className="h-10 px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Apply Filter
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="hidden lg:block">
          <form>
            <div className="relative">
              <span className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2">
                <svg
                  className="fill-gray-500 dark:fill-gray-400"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                    fill=""
                  />
                </svg>
              </span>
              <input
                ref={searchRef}
                value={search}
                onChange={handleSearchChange}
                type="text"
                placeholder="Search by ID, Type, or Location..."
                className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
              />
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border text-sm rounded disabled:opacity-40 bg-trasparent hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.05]"
          >
            Prev
          </button>
          <span className="text-sm font-semibold dark:text-white dark:text-white">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 text-sm py-1 border rounded disabled:opacity-40 bg-trasparent hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.05]"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
            <p className="text-sm text-gray-500 mt-2">
              Loading historical data...
            </p>
          </div>
        )}

        {!loading && readings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-gray-400">
              No telemetry readings found for this query.
            </p>
          </div>
        )}

        {!loading && readings.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b text-sm bg-gray-50 dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Timestamp
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Device ID
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Location
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Device Type
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Reading
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {readings.map((reading, index) => (
                  <TableRow
                    key={
                      reading._id ||
                      `${reading.deviceId}-${reading.timestamp}-${index}`
                    }
                    className={
                      reading._id
                        ? ""
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.03] dark:bg-green-900/10"
                    }
                  >
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90 font-semibold whitespace-nowrap">
                      {formatTimestamp(reading.timestamp)}
                    </TableCell>

                    <TableCell className="px-5 py-4 text-gray-500 dark:text-gray-400">
                      {reading.deviceId}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {reading.location}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {reading.deviceType}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-theme-sm font-mono text-blue-500 font-semibold ">
                      <span className="font-semibold">
                        {reading.reading.toFixed(2)}
                      </span>{" "}
                      <span className="text-blue-500 font-semibold ">
                        {reading.unit}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
