import { AccountantLayout } from "@/components/accountant/AccountantLayout";
import { StaffPageHeader } from "@/components/staff-operations/StaffOperations";
import { SalariesList } from "@/components/crm/finance/SalariesList";

export default function AccountantSalaries() {
  return (
    <AccountantLayout>
      <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
        <StaffPageHeader
          title="Зарплаты врачей"
          description="Расчёт, согласование и выплата зарплат за выбранный месяц."
        />
        <SalariesList />
      </div>
    </AccountantLayout>
  );
}
