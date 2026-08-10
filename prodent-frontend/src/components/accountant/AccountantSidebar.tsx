import { FileText, CreditCard, BarChart3, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RoleSidebar, RoleSidebarNavItem } from '@/components/shared/RoleSidebar';

export const AccountantSidebar = () => {
  const { t } = useLanguage();
  const items: RoleSidebarNavItem[] = [
    { title: t('roleNavigation.accountant.invoices'), path: '/accountant/invoices', icon: FileText },
    { title: t('roleNavigation.accountant.payments'), path: '/accountant/payments', icon: CreditCard },
    { title: t('roleNavigation.accountant.reports'), path: '/accountant/reports', icon: BarChart3 },
    { title: t('roleNavigation.accountant.salaries'), path: '/accountant/salaries', icon: Wallet },
  ];

  return <RoleSidebar roleLabel={t('roleNavigation.accountant.label')} items={items} />;
};
