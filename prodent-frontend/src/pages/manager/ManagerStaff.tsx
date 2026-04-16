import { ManagerLayout } from '@/components/manager/ManagerLayout';

export default function ManagerStaff() {
  return (
    <ManagerLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Управление персоналом</h1>
        <p className="text-muted-foreground">Управление сотрудниками клиники</p>
      </div>
    </ManagerLayout>
  );
}
