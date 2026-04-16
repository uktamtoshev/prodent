import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';

export default function ClinicAdminSettings() {
  return (
    <ClinicAdminLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Настройки клиники</h1>
        <p className="text-muted-foreground">Настройки и конфигурация клиники</p>
      </div>
    </ClinicAdminLayout>
  );
}
