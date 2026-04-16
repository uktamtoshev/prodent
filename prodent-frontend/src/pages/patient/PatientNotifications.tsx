import { PatientLayout } from "@/components/patient/PatientLayout";
import { NotificationsPageContent } from "@/components/notifications/NotificationsPage";

export default function PatientNotifications() {
  return (
    <PatientLayout>
      <div className="p-6 lg:p-8">
        <NotificationsPageContent 
          title="Уведомления"
          subtitle="Напоминания о приёмах и важные сообщения"
        />
      </div>
    </PatientLayout>
  );
}
