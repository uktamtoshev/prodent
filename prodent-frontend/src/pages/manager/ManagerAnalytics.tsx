import { ManagerLayout } from "@/components/manager/ManagerLayout";
import { PerformanceOperations } from "@/components/staff-operations/StaffOperations";

export default function ManagerAnalytics() {
  return (
    <ManagerLayout>
      <PerformanceOperations title="Аналитика" description="Сводка по серверному журналу операций клиники." />
    </ManagerLayout>
  );
}
