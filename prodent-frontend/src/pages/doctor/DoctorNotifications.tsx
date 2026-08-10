import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { NotificationsPageContent } from "@/components/notifications/NotificationsPage";
import { useLanguage } from '@/contexts/LanguageContext';

export default function DoctorNotifications() {
  const { t } = useLanguage();
  return (
    <DoctorLayout>
      <div className="p-6 lg:p-8">
        <NotificationsPageContent
          title={t("doctorNotifications.title")}
          subtitle={t("doctorNotifications.subtitle")}
        />
      </div>
    </DoctorLayout>
  );
}
