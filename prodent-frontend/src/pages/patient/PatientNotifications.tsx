import { PatientLayout } from "@/components/patient/PatientLayout";
import { NotificationsPageContent } from "@/components/notifications/NotificationsPage";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PatientNotifications() {
  const { t } = useLanguage();
  return (
    <PatientLayout>
      <div className="p-6 lg:p-8">
        <NotificationsPageContent
          title={t("patientCabinet.notificationsPageTitle")}
          subtitle={t("patientCabinet.notificationsPageDesc")}
        />
      </div>
    </PatientLayout>
  );
}
