import EcommerceMetrics from "../../components/ecommerce/TelemetryMetrics";
import MonthlySalesChart from "../../components/ecommerce/PowerTrendChart";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import PageMeta from "../../components/common/PageMeta";
import UsageBreakdownChart from "../../components/ecommerce/UsageBreakdownChart";

export default function Home() {
  return (
    <>
      <PageMeta
        title="React.js Ecommerce Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Ecommerce Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 ">
          <EcommerceMetrics />

          <MonthlySalesChart />

          <UsageBreakdownChart />
        </div>

        <div className="col-span-12 ">
          <RecentOrders />
        </div>
      </div>
    </>
  );
}
