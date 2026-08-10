import { ManagerLayout } from "@/components/manager/ManagerLayout";
import { PerformanceOperations } from "@/components/staff-operations/StaffOperations";

export default function ManagerKPI() {
  return (
    <ManagerLayout>
      <PerformanceOperations title="KPI" description="Записи, оплаты, возвраты и долги за текущий месяц." />
    </ManagerLayout>
  );
}
