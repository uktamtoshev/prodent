import { AssistantLayout } from "@/components/assistant/AssistantLayout";
import { ScheduleOperations } from "@/components/staff-operations/StaffOperations";

export default function AssistantRooms() {
  return (
    <AssistantLayout>
      <ScheduleOperations title="Подготовка кабинетов" description="Кабинеты и кресла, используемые сегодня." roomsOnly />
    </AssistantLayout>
  );
}
