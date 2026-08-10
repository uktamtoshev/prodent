import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { FinanceOperations } from "@/components/staff-operations/StaffOperations";

export default function ClinicAdminPayments() {
  return (
    <ClinicAdminLayout>
      <FinanceOperations title="Касса и оплаты" kind="payments" />
    </ClinicAdminLayout>
  );
}
