import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { ScheduleOperations } from "@/components/staff-operations/StaffOperations";

export default function ClinicAdminAppointments() {
  return (
    <ClinicAdminLayout>
      <ScheduleOperations title="Записи" description="Все записи клиники на текущий день." />
    </ClinicAdminLayout>
  );
}
