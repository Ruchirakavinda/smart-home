import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import TelemetryReadingTable from "../../components/telemetry-readings/TelemetryReadingTable";

export default function TelemetryReadings() {
  return (
    <>
      <PageMeta
        title="Telemetry Readings"
        description="This is the Telemetry Readings page."
      />
      <PageBreadcrumb pageTitle="Telemetry Readings" />
      <div className="space-y-6">
        
          <TelemetryReadingTable />
     
      </div>
    </>
  );
}
