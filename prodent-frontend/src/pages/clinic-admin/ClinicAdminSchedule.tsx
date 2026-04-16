import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';

export default function ClinicAdminSchedule() {
  return (
    <ClinicAdminLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Расписание</h1>
        <p className="text-muted-foreground">Управление расписанием клиники</p>
      </div>
    </ClinicAdminLayout>
  );
}
