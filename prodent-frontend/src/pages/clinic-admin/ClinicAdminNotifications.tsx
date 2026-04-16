import { ClinicAdminLayout } from '@/components/clinic-admin/ClinicAdminLayout';
import { NotificationsPageContent } from "@/components/notifications/NotificationsPage";

export default function ClinicAdminNotifications() {
  return (
    <ClinicAdminLayout>
      <div className="p-6 lg:p-8">
        <NotificationsPageContent 
          title="Уведомления"
          subtitle="Управление уведомлениями клиники"
        />
      </div>
    </ClinicAdminLayout>
  );
}
