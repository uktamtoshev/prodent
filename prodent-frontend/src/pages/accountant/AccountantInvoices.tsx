import { AccountantLayout } from "@/components/accountant/AccountantLayout";
import { FinanceOperations } from "@/components/staff-operations/StaffOperations";

export default function AccountantInvoices() {
  return (
    <AccountantLayout>
      <FinanceOperations title="Счета" kind="invoices" />
    </AccountantLayout>
  );
}
