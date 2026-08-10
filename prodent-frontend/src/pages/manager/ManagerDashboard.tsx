import { ManagerLayout } from "@/components/manager/ManagerLayout";
import { PerformanceOperations } from "@/components/staff-operations/StaffOperations";

export default function ManagerDashboard() {
  return (
    <ManagerLayout>
      <PerformanceOperations title="Обзор" description="Главные показатели клиники за текущий месяц." />
    </ManagerLayout>
  );
}
