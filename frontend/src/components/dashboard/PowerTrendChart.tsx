import React, { useState, useEffect, MouseEvent } from "react";

interface TrendDataPoint {
  timeLabel: string;
  [key: string]: number | string;
}

interface TelemetryTrendsResponse {
  unit: string;
  dataKey: string;
  data: TrendDataPoint[];
  window: string;
}

interface ChartState {
  categories: string[];
  series: { name: string; data: number[] }[];
  unitLabel: string;
  timeWindow: string;
}

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;

const TRENDS_API_PATH = BACKEND_BASE_URL + import.meta.env.VITE_TRENDS_API_PATH;

const WINDOW_OPTIONS: { key: string; label: string }[] = [
  { key: "24h", label: "Last 24 Hours" },
  { key: "7d", label: "Last 7 Days" },
];

const formatCategoryLabel = (isoString: string, window: string): string => {
  if (window === "24h") {
    const hourMatch = isoString.match(/T(\d{2})$/);

    if (hourMatch && hourMatch[1]) {
      return hourMatch[1];
    }

    return isoString.split("T")[1] || isoString;
  }

  if (window === "7d") {
    try {
      const dateToParse =
        isoString.includes("T") && !isoString.endsWith("Z")
          ? isoString + "Z"
          : isoString;
      const date = new Date(dateToParse);

      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          timeZone: "UTC",
        }).format(date);
      }
    } catch (e) {}
  }

  return isoString;
};

interface DropdownProps {
  children: React.ReactNode;
  isOpen: boolean;
  closeDropdown: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({ children, isOpen }) =>
  isOpen ? (
    <div
      className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-10 dark:bg-gray-700/95 dark:ring-gray-600`}
    >
      <div className="py-1">{children}</div>
    </div>
  ) : null;

interface DropdownItemProps {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  active?: boolean;
}
const DropdownItem: React.FC<DropdownItemProps> = ({
  onClick,
  children,
  active = false,
}) => (
  <button
    onClick={onClick}
    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
      active
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
    }`}
  >
    {children}
  </button>
);

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center h-48">
    <div className="size-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
  </div>
);

interface SimpleBarChartProps {
  categories: string[];
  series: { name: string; data: number[] }[];
  unitLabel: string;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  categories,
  series,
  unitLabel,
}) => {
  const width = 600;
  const height = 180;
  const margin = { top: 40, right: 10, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const data = series[0]?.data || [];

  if (data.length === 0) {
    return (
      <div
        className="flex justify-center items-center h-full text-gray-500"
        style={{ height: height + margin.top + margin.bottom }}
      >
        No energy usage data available.
      </div>
    );
  }

  const maxVal = Math.max(...data);

  const paddedMaxVal = maxVal * 1.1;
  const scaleY = (d: number) => innerHeight * (d / paddedMaxVal);
  const barWidth = innerWidth / data.length / 1.5;
  const barGap = innerWidth / data.length / 3;

  const formatter = (val: number) => val.toFixed(2);

  const numTicks = 4;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const value = (paddedMaxVal / numTicks) * i;
    const y = innerHeight - scaleY(value);
    return { value: formatter(value), y: y };
  }).reverse();

  return (
    <div
      className="pt-2"
      style={{ height: height + margin.top + margin.bottom, overflowX: "auto" }}
    >
      <svg
        viewBox={`0 0 ${width + margin.left + margin.right} ${
          height + margin.bottom + margin.top
        }`}
        style={{ minWidth: `${width}px` }}
        className="w-full"
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {ticks.map(({ value, y }, index) => (
            <g key={index}>
              <line
                x1={0}
                y1={y}
                x2={innerWidth}
                y2={y}
                stroke={index === numTicks ? "none" : "#e5e7eb"}
                strokeDasharray="3 3"
                className="dark:stroke-gray-700"
              />
              {index !== numTicks && (
                <text
                  x={-5}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#6b7280"
                  className="dark:fill-gray-400 font-inter"
                >
                  {value}
                </text>
              )}
            </g>
          ))}

          {data.map((d, i) => {
            const barHeight = scaleY(d);
            const x = i * (barWidth + barGap);
            const y = innerHeight - barHeight;

            return (
              <React.Fragment key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill="#4f46e5"
                  className="transition-all duration-300"
                />

                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="#1f2937"
                  className="dark:fill-gray-100 font-inter"
                >
                  {formatter(d)} {unitLabel}
                </text>
              </React.Fragment>
            );
          })}

          {categories.map((label, i) => (
            <text
              key={i}
              x={i * (barWidth + barGap) + barWidth / 2}
              y={innerHeight + 15}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
              className="dark:fill-gray-400 font-inter"
            >
              {label}
            </text>
          ))}

          <line
            x1={0}
            y1={innerHeight}
            x2={innerWidth}
            y2={innerHeight}
            stroke="#d1d5db"
            className="dark:stroke-gray-700"
          />
        </g>
      </svg>
    </div>
  );
};

const initialChartState: ChartState = {
  categories: [],
  series: [{ name: "Loading", data: [] }],
  unitLabel: "N/A",
  timeWindow: "24h",
};

export default function PowerTrendChart() {
  const [chartData, setChartData] = useState<ChartState>(initialChartState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [timeWindow, setTimeWindow] = useState<string>("24h");

  const processData = (apiData: TelemetryTrendsResponse): ChartState => {
    if (!apiData || !apiData.data || apiData.data.length === 0) {
      return {
        categories: ["No Data"],
        series: [{ name: "No Readings", data: [0] }],
        unitLabel: "kWh",
        timeWindow: apiData.window,
      };
    }

    const categories: string[] = apiData.data.map((item) =>
      formatCategoryLabel(item.timeLabel, apiData.window)
    );

    const dataKey: string = "usageKWh";

    const seriesData: number[] = apiData.data.map(
      (item) => (item[dataKey] as number) || 0
    );

    const series = [
      {
        name: `Usage Trend`,
        data: seriesData,
      },
    ];

    const effectiveUnitLabel = "kWh";

    return {
      categories,
      series,
      unitLabel: effectiveUnitLabel,
      timeWindow: apiData.window,
    };
  };

  useEffect(() => {
    const fetchTrends = async () => {
      setIsLoading(true);

      const url: string = `${TRENDS_API_PATH}?window=${timeWindow}`;

      const maxRetries = 3;
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries && !success) {
        attempts++;
        try {
          const response = await fetch(url);

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
              `HTTP error! Status: ${response.status}. Body: ${errorBody}`
            );
          }

          const apiResponse: TelemetryTrendsResponse = await response.json();
          const newState = processData(apiResponse);
          setChartData(newState);
          success = true;
        } catch (error) {
          if (attempts < maxRetries) {
            const delay = Math.pow(2, attempts - 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            setChartData({
              categories: ["API Error"],
              series: [{ name: "Failed to Load", data: [0] }],
              unitLabel: "kWh",
              timeWindow: timeWindow,
            });
          }
        }
      }
      setIsLoading(false);
    };

    fetchTrends();
  }, [timeWindow]);

  const handleWindowChange = (key: string) => {
    setTimeWindow(key);
    setDropdownOpen(false);
  };

  const currentWindowLabel: string =
    WINDOW_OPTIONS.find((o) => o.key === timeWindow)?.label || "24 Hours";
  const chartTitle: string = `Energy Usage Trend (${currentWindowLabel})`;

  const requiredChartHeight = 330;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {chartTitle}
        </h3>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen((d) => !d)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {currentWindowLabel}
          </button>
          <Dropdown
            isOpen={dropdownOpen}
            closeDropdown={() => setDropdownOpen(false)}
          >
            {WINDOW_OPTIONS.map((opt) => (
              <DropdownItem
                key={opt.key}
                onClick={() => handleWindowChange(opt.key)}
                active={opt.key === timeWindow}
              >
                {opt.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        {isLoading ? (
          <div style={{ height: requiredChartHeight }}>
            <LoadingSpinner />
          </div>
        ) : (
          <SimpleBarChart
            categories={chartData.categories}
            series={chartData.series}
            unitLabel={chartData.unitLabel}
          />
        )}
      </div>
    </div>
  );
}
