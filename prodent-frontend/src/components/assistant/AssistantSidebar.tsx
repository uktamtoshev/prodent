import { Calendar, Home, Package, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RoleSidebar, RoleSidebarNavItem } from '@/components/shared/RoleSidebar';

export const AssistantSidebar = () => {
  const { t } = useLanguage();
  const items: RoleSidebarNavItem[] = [
    { title: t('roleNavigation.assistant.schedule'), path: '/assistant/schedule', icon: Calendar },
    { title: t('roleNavigation.assistant.rooms'), path: '/assistant/rooms', icon: Home },
    { title: t('roleNavigation.assistant.materials'), path: '/assistant/materials', icon: Package },
    { title: t('roleNavigation.assistant.appointments'), path: '/assistant/appointments', icon: Users },
  ];

  return <RoleSidebar roleLabel={t('roleNavigation.assistant.label')} items={items} />;
};
