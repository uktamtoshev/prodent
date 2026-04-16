import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';

export default function ClinicAdminPayments() {
  return (
    <ClinicAdminLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Касса и оплаты</h1>
        <p className="text-muted-foreground">Управление платежами и кассой</p>
      </div>
    </ClinicAdminLayout>
  );
}
