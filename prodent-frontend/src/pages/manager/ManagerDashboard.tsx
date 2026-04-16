import { ManagerLayout } from '@/components/manager/ManagerLayout';

export default function ManagerDashboard() {
  return (
    <ManagerLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Общий обзор показателей клиники</p>
      </div>
    </ManagerLayout>
  );
}
