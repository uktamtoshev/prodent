import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';

export default function ClinicAdminAppointments() {
  return (
    <ClinicAdminLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Записи</h1>
        <p className="text-muted-foreground">Управление записями пациентов</p>
      </div>
    </ClinicAdminLayout>
  );
}
