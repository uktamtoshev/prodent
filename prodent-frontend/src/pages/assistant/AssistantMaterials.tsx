import { AssistantLayout } from '@/components/assistant/AssistantLayout';

export default function AssistantMaterials() {
  return (
    <AssistantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Материалы</h1>
        <p className="text-muted-foreground">Управление медицинскими материалами</p>
      </div>
    </AssistantLayout>
  );
}
