import { AssistantLayout } from "@/components/assistant/AssistantLayout";
import { ScheduleOperations } from "@/components/staff-operations/StaffOperations";

export default function AssistantAppointments() {
  return (
    <AssistantLayout>
      <ScheduleOperations title="Сопровождение приёмов" description="Пациенты и врачи, которых нужно подготовить к приёму." />
    </AssistantLayout>
  );
}
