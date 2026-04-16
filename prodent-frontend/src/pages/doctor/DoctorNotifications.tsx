import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { NotificationsPageContent } from "@/components/notifications/NotificationsPage";

export default function DoctorNotifications() {
  return (
    <DoctorLayout>
      <div className="p-6 lg:p-8">
        <NotificationsPageContent 
          title="Уведомления"
          subtitle="Записи пациентов и важные события"
        />
      </div>
    </DoctorLayout>
  );
}
