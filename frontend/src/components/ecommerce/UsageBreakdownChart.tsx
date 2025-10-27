import React, { useState, useEffect, MouseEvent } from "react";

interface ApiBreakdownDataPoint {
  name: string;
  value: number;
}

interface TelemetryBreakdownResponse {
  groupBy: "location" | "category";
  unit: string;
  data: ApiBreakdownDataPoint[];
}

interface PieChartSegment extends ApiBreakdownDataPoint {
  color: string;
  percentage: number;
}

interface ChartState {
  segments: PieChartSegment[];
  unitLabel: string;
  breakdownKey: "location" | "category";
}

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const BREAKDOWN_API_PATH =
  BACKEND_BASE_URL + import.meta.env.VITE_USAGE_BREAKDOWN_API_PATH;

const BREAKDOWN_OPTIONS: { key: "location" | "category"; label: string }[] = [
  { key: "location", label: "By Location" },
  { key: "category", label: "By Category" },
];

const generateColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = (hash * 37) % 360;
  const s = 65;
  const l = 60;

  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
    } else if (120 <= h && h < 180) {
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      b = c;
    } else if (300 <= h && h < 360) {
      r = c;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    const toHex = (c: number) => c.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  return hslToHex(h, s, l);
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
  <div className="flex justify-center items-center h-full">
    <div className="size-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent"></div>
  </div>
);

interface SimplePieChartProps {
  segments: PieChartSegment[];
  unitLabel: string;
}

const SimplePieChart: React.FC<SimplePieChartProps> = ({
  segments,
  unitLabel,
}) => {
  const size = 300;
  const halfSize = size / 2;
  const radius = size / 2 - 10;
  const totalValue = segments.reduce((sum, s) => sum + s.value, 0);

  if (segments.length === 0 || totalValue === 0) {
    return (
      <div className="flex justify-center items-center p-8 h-[300px] text-gray-500">
        No usage data to display breakdown.
      </div>
    );
  }

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent) * radius;
    const y = Math.sin(2 * Math.PI * percent) * radius;
    return [halfSize + x, halfSize + y];
  };

  let cumulativePercent = 0;

  const paths = segments.map((segment) => {
    const percent = segment.value / totalValue;
    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);

    cumulativePercent += percent;

    if (percent >= 0.999) {
      return {
        d: [
          `M ${halfSize} ${halfSize}`,
          `m 0 ${-radius}`,
          `a ${radius} ${radius} 0 1 0 0 ${2 * radius}`,
          `a ${radius} ${radius} 0 1 0 0 ${-2 * radius}`,
          `Z`,
        ].join(" "),
        color: segment.color,
      };
    }

    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

    const largeArcFlag = percent > 0.5 ? 1 : 0;

    const d = [
      `M ${halfSize} ${halfSize}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `Z`,
    ].join(" ");

    return { d, color: segment.color };
  });

  return (
    <div className="flex flex-col md:flex-row items-start md:items-start justify-center gap-8 p-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 "
      >
        <g transform={`rotate(-90 ${halfSize} ${halfSize})`}>
          {paths.map((path, index) => (
            <path
              key={index}
              d={path.d}
              fill={path.color}
              stroke="white"
              strokeWidth="1"
              className="transition-all duration-500 hover:opacity-85  "
            />
          ))}
        </g>
      </svg>
      <div className="flex flex-col justify-between h-full pt-3">
        <text
          x={halfSize}
          y={halfSize}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fill="#374151"
          className="dark:text-gray-300 font-inter font-bold ml-2 mb-3 text-lg"
        >
          Total Usage :
          <span className="text-blue-500 dark:text-gray-400 ml-2">
            {totalValue.toFixed(2)} {unitLabel}
          </span>
        </text>

        <div className="grid sm:grid-cols-2 grid-cols-1 gap-2 overflow-y-auto max-h-[300px] w-full md:w-auto min-w-[250px] ">
          {segments.map((segment) => (
            <div
              key={segment.name}
              className="flex items-center justify-between gap-3 p-2 rounded-lg"
            >
              <div className="flex items-center gap-3  min-w-0">
                <div
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: segment.color }}
                />

                <span className=" font-medium text-gray-700 dark:text-gray-300 truncate">
                  {segment.name}
                </span>
              </div>

              <div className="flex items-baseline text-right text-sm shrink-0">
                {" "}
                <span className="font-bold text-gray-800 dark:text-white mr-1">
                  {segment.percentage.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({segment.value.toFixed(2)} {unitLabel})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const initialChartState: ChartState = {
  segments: [],
  unitLabel: "kWh",
  breakdownKey: "location",
};

export default function UsageBreakdownChart() {
  const [chartData, setChartData] = useState<ChartState>(initialChartState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const [breakdownKey, setBreakdownKey] = useState<"location" | "category">(
    "location"
  );

  const processData = (apiData: TelemetryBreakdownResponse): ChartState => {
    if (!apiData || !apiData.data || apiData.data.length === 0) {
      return {
        segments: [],
        unitLabel: "kWh",
        breakdownKey: apiData.groupBy,
      };
    }

    const totalValue = apiData.data.reduce((sum, item) => sum + item.value, 0);

    const segments: PieChartSegment[] = apiData.data
      .map((item) => {
        const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
        return {
          name: item.name,
          value: item.value,
          color: generateColor(item.name),
          percentage: percentage,
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      segments,
      unitLabel: apiData.unit,
      breakdownKey: apiData.groupBy,
    };
  };

  useEffect(() => {
    const fetchBreakdown = async () => {
      setIsLoading(true);

      const url: string = `${BREAKDOWN_API_PATH}?by=${breakdownKey}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const apiResponse: TelemetryBreakdownResponse = await response.json();
        const newState = processData({ ...apiResponse, groupBy: breakdownKey });
        setChartData(newState);
      } catch (error) {
        console.error("Failed to fetch breakdown data:", error);
        setChartData({
          segments: [],
          unitLabel: "kWh",
          breakdownKey: breakdownKey,
        });
      }
      setIsLoading(false);
    };

    fetchBreakdown();
  }, [breakdownKey]);

  const handleBreakdownChange = (key: "location" | "category") => {
    setBreakdownKey(key);
    setDropdownOpen(false);
  };

  const currentBreakdownLabel: string =
    BREAKDOWN_OPTIONS.find((o) => o.key === breakdownKey)?.label ||
    "By Location";
  const chartTitle: string = `Energy Usage Breakdown  (${currentBreakdownLabel})`;

  const requiredChartHeight = 350;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {chartTitle}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Last 7 Days</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen((d) => !d)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {currentBreakdownLabel}
          </button>
          <Dropdown
            isOpen={dropdownOpen}
            closeDropdown={() => setDropdownOpen(false)}
          >
            {BREAKDOWN_OPTIONS.map((opt) => (
              <DropdownItem
                key={opt.key}
                onClick={() => handleBreakdownChange(opt.key)}
                active={opt.key === breakdownKey}
              >
                {opt.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="max-w-full">
        {isLoading ? (
          <div style={{ height: requiredChartHeight }}>
            <LoadingSpinner />
          </div>
        ) : (
          <SimplePieChart
            segments={chartData.segments}
            unitLabel={chartData.unitLabel}
          />
        )}
      </div>
    </div>
  );
}
