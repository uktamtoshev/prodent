import { AssistantLayout } from '@/components/assistant/AssistantLayout';

export default function AssistantSchedule() {
  return (
    <AssistantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Расписание</h1>
        <p className="text-muted-foreground">Расписание приёмов и процедур</p>
      </div>
    </AssistantLayout>
  );
}
