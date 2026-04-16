import { AssistantLayout } from '@/components/assistant/AssistantLayout';

export default function AssistantAppointments() {
  return (
    <AssistantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Сопровождение приёмов</h1>
        <p className="text-muted-foreground">Ассистирование на приёмах</p>
      </div>
    </AssistantLayout>
  );
}
