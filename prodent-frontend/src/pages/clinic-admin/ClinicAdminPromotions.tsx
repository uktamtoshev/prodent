import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';

export default function ClinicAdminPromotions() {
  return (
    <ClinicAdminLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Акции</h1>
        <p className="text-muted-foreground">Управление акциями и специальными предложениями</p>
      </div>
    </ClinicAdminLayout>
  );
}
