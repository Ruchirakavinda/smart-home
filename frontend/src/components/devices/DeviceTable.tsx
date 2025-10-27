import { useEffect, useState, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

interface Device {
  deviceId: string;
  location: string;
  deviceType: string;
  status: string;
  lastReported: string;
}

export default function DeviceTable() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
  const DEVICES_API_URL =
    BACKEND_BASE_URL + import.meta.env.VITE_DEVICES_API_PATH;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${DEVICES_API_URL}?page=${page}&limit=10&search=${search}`
        );
        const json = await res.json();

        setDevices(json?.data?.devices || []);
        setTotalPages(json?.data?.pagination?.totalPages || 1);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [page, search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const formatLastReported = (isoString: string): string => {
    try {
      if (!isoString) return "N/A";

      const date = new Date(isoString);

      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");
      const seconds = String(date.getUTCSeconds()).padStart(2, "0");

      return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return "Invalid Date";
    }
  };
  return (
    <div className="space-y-4">
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
                placeholder="Search by device ID or Device Type..."
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
          <span className="text-sm font-semibold  dark:text-white">
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
            <p className="text-sm text-gray-500 mt-2">Loading...</p>
          </div>
        )}

        {!loading && devices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm text-gray-400">No devices found</p>
          </div>
        )}

        {/* Table (only when data exists) */}
        {!loading && devices.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
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
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                  >
                    Last Reported
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {devices.map((device) => (
                  <TableRow key={device.deviceId}>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90 font-semibold">
                      {device.deviceId}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {device.location}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {device.deviceType}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Badge
                        size="md"
                        color={
                          device.status === "online"
                            ? "success"
                            : device.status === "offline"
                            ? "error"
                            : "warning"
                        }
                      >
                        {device.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatLastReported(device.lastReported)}
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
