import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import DeviceTable from "../../components/devices/DeviceTable";

export default function Devices() {
  return (
    <>
      <PageMeta
        title="Devices"
        description="This is the Devices page."
      />
      <PageBreadcrumb pageTitle="Devices" />
      <div className="space-y-6">
        <ComponentCard title="All Smart Devices">
          <DeviceTable />
        </ComponentCard>
      </div>
    </>
  );
}
