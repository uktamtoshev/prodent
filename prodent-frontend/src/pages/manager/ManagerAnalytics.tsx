import { ManagerLayout } from '@/components/manager/ManagerLayout';

export default function ManagerAnalytics() {
  return (
    <ManagerLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Аналитика</h1>
        <p className="text-muted-foreground">Детальная аналитика и отчёты</p>
      </div>
    </ManagerLayout>
  );
}
