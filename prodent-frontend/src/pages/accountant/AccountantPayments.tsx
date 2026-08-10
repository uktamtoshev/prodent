import { AccountantLayout } from "@/components/accountant/AccountantLayout";
import { FinanceOperations } from "@/components/staff-operations/StaffOperations";

export default function AccountantPayments() {
  return (
    <AccountantLayout>
      <FinanceOperations title="Оплаты" kind="payments" />
    </AccountantLayout>
  );
}
