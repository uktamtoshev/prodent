import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { ScheduleOperations } from "@/components/staff-operations/StaffOperations";

export default function ClinicAdminSchedule() {
  return (
    <ClinicAdminLayout>
      <ScheduleOperations title="Расписание" description="Записи, врачи и кабинеты на сегодня." />
    </ClinicAdminLayout>
  );
}
