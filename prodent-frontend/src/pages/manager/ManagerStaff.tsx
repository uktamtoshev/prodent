import { ManagerLayout } from "@/components/manager/ManagerLayout";
import { StaffPageHeader } from "@/components/staff-operations/StaffOperations";
import { UsersManager } from "@/components/crm/settings/UsersManager";

export default function ManagerStaff() {
  return (
    <ManagerLayout>
      <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
        <StaffPageHeader
          title="Управление персоналом"
          description="Сотрудники, роли и доступ к выбранной клинике."
        />
        <UsersManager />
      </div>
    </ManagerLayout>
  );
}
