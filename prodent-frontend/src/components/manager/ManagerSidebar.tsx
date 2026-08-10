import { LayoutDashboard, Target, BarChart3, Users, Briefcase } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RoleSidebar, RoleSidebarNavItem } from '@/components/shared/RoleSidebar';

export const ManagerSidebar = () => {
  const { t } = useLanguage();

  const items: RoleSidebarNavItem[] = [
    { title: t('roleNavigation.manager.overview'), path: '/manager/dashboard', icon: LayoutDashboard, end: true },
    { title: t('roleNavigation.manager.kpi'), path: '/manager/kpi', icon: Target },
    { title: t('roleNavigation.manager.analytics'), path: '/manager/analytics', icon: BarChart3 },
    { title: t('roleNavigation.manager.staff'), path: '/manager/staff', icon: Users },
    { title: t('roleNavigation.manager.services'), path: '/manager/services', icon: Briefcase },
  ];

  return <RoleSidebar roleLabel={t('roleNavigation.manager.label')} items={items} />;
};
