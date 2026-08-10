import { useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  Calendar,
  CreditCard,
  Megaphone,
  FileCheck,
  MessageSquare,
  Tag,
  FileText,
  Settings,
  Shield,
  ClipboardCheck,
  Award,
  Percent,
  Plug,
  FlaskConical,
  Gift,
  ShoppingCart,
  Store,
  Package,
  Flag,
  Megaphone as Broadcast,
  Star,
  Scale,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jobs } from '@/lib/jobs';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import {
  RoleSidebar,
  RoleSidebarNavGroup,
} from '@/components/shared/RoleSidebar';

const GROUP_LABELS: Record<Language, { catalog: string; content: string; moderation: string; operations: string; system: string }> = {
  ru:      { catalog: 'Каталог',  content: 'Контент',   moderation: 'Модерация', operations: 'Операции',  system: 'Система' },
  uz:      { catalog: 'Katalog',  content: 'Kontent',   moderation: 'Moderatsiya', operations: 'Operatsiyalar', system: 'Tizim' },
  uz_cyrl: { catalog: 'Каталог',  content: 'Контент',   moderation: 'Модерация', operations: 'Операциялар', system: 'Тизим' },
  kz:      { catalog: 'Каталог',  content: 'Контент',   moderation: 'Модерация', operations: 'Операциялар', system: 'Жүйе' },
  kg:      { catalog: 'Каталог',  content: 'Контент',   moderation: 'Модерация', operations: 'Операциялар', system: 'Тутум' },
  tj:      { catalog: 'Каталог',  content: 'Контент',   moderation: 'Модерация', operations: 'Амалиётҳо', system: 'Система' },
};

export const AdminSidebar = () => {
  const { t, language } = useLanguage();
  const { isSuperAdmin, isModerator } = useUserRole();

  // Count of pending applications — surfaced as a red badge on the
  // moderation/verification nav item so admins notice queued work.
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-applications-count'],
    queryFn: async () => {
      const [doctorRes, clinicRes] = await Promise.all([
        supabase.from('doctor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('clinic_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      return (doctorRes.count || 0) + (clinicRes.count || 0);
    },
    enabled: !isModerator,
    refetchInterval: 30000,
  });

  // Open job-report complaints — badge on the moderation nav item. Best-effort: the jobs
  // API may 403 for a non-module role, so failures fall back to 0.
  const { data: openReports = 0 } = useQuery({
    queryKey: ['open-job-reports-count'],
    queryFn: async () => {
      try {
        const list = (await jobs.listReports('open')) as unknown[];
        return Array.isArray(list) ? list.length : 0;
      } catch {
        return 0;
      }
    },
    enabled: !isModerator,
    refetchInterval: 30000,
  });

  const L = GROUP_LABELS[language];

  const groups: RoleSidebarNavGroup[] = useMemo(
    () => isModerator ? [
      {
        label: L.moderation,
        items: [
          { title: t('adminSidebar.moderation'), path: '/admin/moderation', icon: FileCheck },
          { title: t('adminSidebar.reviews'), path: '/admin/reviews', icon: MessageSquare },
          { title: t('adminSidebar.marketProducts'), path: '/admin/market/products', icon: Package },
          { title: t('adminSidebar.marketReviews'), path: '/admin/market/reviews', icon: Star },
          { title: 'Споры и возвраты', path: '/admin/market/disputes', icon: Scale },
        ],
      },
    ] : [
      // Dashboard — no label, anchored at the top.
      {
        items: [
          { title: t('adminSidebar.dashboard'), path: '/admin', icon: LayoutDashboard, end: true },
        ],
      },
      // Каталог — read-views over core entities + transaction log.
      {
        label: L.catalog,
        items: [
          { title: t('adminSidebar.doctors'),      path: '/admin/doctors',      icon: Users },
          { title: t('adminSidebar.clinics'),      path: '/admin/clinics',      icon: Building2 },
          { title: t('adminSidebar.patients'),     path: '/admin/patients',     icon: UserCircle },
          { title: t('adminSidebar.appointments'), path: '/admin/appointments', icon: Calendar },
          { title: t('adminSidebar.payments'),     path: '/admin/payments',     icon: CreditCard },
        ],
      },
      // Контент — marketing surfaces and editorial.
      {
        label: L.content,
        items: [
          { title: t('adminSidebar.ads'),        path: '/admin/ads',        icon: Megaphone },
          { title: t('adminSidebar.badges'),     path: '/admin/badges',     icon: Award },
          { title: t('adminSidebar.promotions'), path: '/admin/promotions', icon: Percent },
          { title: t('adminSidebar.promo'),      path: '/admin/promo',      icon: Tag },
          { title: t('adminSidebar.blog'),       path: '/admin/blog',       icon: FileText },
        ],
      },
      // Модерация — queued items needing admin review.
      {
        label: L.moderation,
        items: [
          { title: t('adminSidebar.moderation'),   path: '/admin/moderation',   icon: FileCheck },
          { title: t('adminSidebar.reviews'),      path: '/admin/reviews',      icon: MessageSquare },
          { title: t('adminSidebar.verification'), path: '/admin/verification', icon: ClipboardCheck, badge: pendingCount },
          { title: t('adminSidebar.jobReports'),   path: '/admin/job-reports',  icon: Flag, badge: openReports },
        ],
      },
      // Операции — cross-cutting operational views (lab domain, referrals, later marketplace ops).
      {
        label: L.operations,
        items: [
          { title: t('adminSidebar.lab'), path: '/admin/lab', icon: FlaskConical },
          { title: t('adminSidebar.referrals'), path: '/admin/referrals', icon: Gift },
          { title: t('adminSidebar.marketOrders'), path: '/admin/market/orders', icon: ShoppingCart },
          { title: t('adminSidebar.marketSellers'), path: '/admin/market/sellers', icon: Store },
          { title: t('adminSidebar.marketProducts'), path: '/admin/market/products', icon: Package },
          { title: t('adminSidebar.marketReviews'), path: '/admin/market/reviews', icon: Star },
          { title: 'Споры и возвраты', path: '/admin/market/disputes', icon: Scale },
        ],
      },
      // Система — platform admin (users / integrations / settings).
      {
        label: L.system,
        items: [
          { title: t('adminSidebar.users'),    path: '/admin/users',    icon: Shield },
          { title: t('adminSidebar.broadcast'), path: '/admin/broadcast', icon: Broadcast },
          ...(isSuperAdmin
            ? [{ title: t('adminSidebar.integrations') || 'Интеграции', path: '/admin/integrations', icon: Plug }]
            : []),
          { title: t('adminSidebar.settings'), path: '/admin/settings', icon: Settings },
        ],
      },
    ],
    [t, L, isModerator, isSuperAdmin, openReports, pendingCount]
  );

  return <RoleSidebar roleLabel={t('adminSidebar.adminPanel')} items={groups} />;
};
