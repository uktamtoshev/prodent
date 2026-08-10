import { Calendar, Users, CreditCard, Megaphone, Bell, Settings, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RoleSidebar, RoleSidebarNavItem } from '@/components/shared/RoleSidebar';

export const ClinicAdminSidebar = () => {
  const { t } = useLanguage();
  const items: RoleSidebarNavItem[] = [
    { title: t('roleNavigation.clinicAdmin.schedule'), path: '/clinic-admin/schedule', icon: Calendar, end: true },
    { title: t('roleNavigation.clinicAdmin.appointments'), path: '/clinic-admin/appointments', icon: Calendar },
    { title: t('roleNavigation.clinicAdmin.patients'), path: '/clinic-admin/patients', icon: Users },
    { title: t('roleNavigation.clinicAdmin.messages'), path: '/clinic-admin/messages', icon: MessageCircle },
    { title: t('roleNavigation.clinicAdmin.payments'), path: '/clinic-admin/payments', icon: CreditCard },
    { title: t('roleNavigation.clinicAdmin.promotions'), path: '/clinic-admin/promotions', icon: Megaphone },
    { title: t('roleNavigation.clinicAdmin.notifications'), path: '/clinic-admin/notifications', icon: Bell },
    { title: t('roleNavigation.clinicAdmin.settings'), path: '/clinic-admin/settings', icon: Settings },
  ];

  return <RoleSidebar roleLabel={t('roleNavigation.clinicAdmin.label')} items={items} />;
};
