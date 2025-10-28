import EcommerceMetrics from "../../components/dashboard/TelemetryMetrics";
import MonthlySalesChart from "../../components/dashboard/PowerTrendChart";
import PageMeta from "../../components/common/PageMeta";
import UsageBreakdownChart from "../../components/dashboard/UsageBreakdownChart";
import RecentTelemetryReadingTable from "../../components/telemetry-readings/RecentTelemetryReadingTable";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Smart Home Monitor Dashboard"
        description="This is the Smart Home Monitor Dashboard page."
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 ">
          <EcommerceMetrics />

          <MonthlySalesChart />

          <UsageBreakdownChart />
        </div>

        <div className="col-span-12 ">
          <RecentTelemetryReadingTable />
        </div>
      </div>
    </>
  );
}
