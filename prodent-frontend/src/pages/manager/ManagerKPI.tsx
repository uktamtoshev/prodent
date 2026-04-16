import { ManagerLayout } from '@/components/manager/ManagerLayout';

export default function ManagerKPI() {
  return (
    <ManagerLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">KPI</h1>
        <p className="text-muted-foreground">Ключевые показатели эффективности</p>
      </div>
    </ManagerLayout>
  );
}
