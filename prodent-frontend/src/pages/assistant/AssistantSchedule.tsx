import { AssistantLayout } from "@/components/assistant/AssistantLayout";
import { ScheduleOperations } from "@/components/staff-operations/StaffOperations";

export default function AssistantSchedule() {
  return (
    <AssistantLayout>
      <ScheduleOperations title="Расписание" description="Рабочий план клиники на сегодня." />
    </AssistantLayout>
  );
}
