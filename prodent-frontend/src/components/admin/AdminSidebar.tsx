import { NavLink, Link } from 'react-router-dom';
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
  LogOut,
  Shield,
  ClipboardCheck,
  Award,
  Percent,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import prodentLogo from "@/assets/prodent-logo.png";

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборд', path: '/admin' },
  { icon: Users, label: 'Все врачи', path: '/admin/doctors' },
  { icon: Building2, label: 'Все клиники', path: '/admin/clinics' },
  { icon: UserCircle, label: 'Все пациенты', path: '/admin/patients' },
  { icon: Calendar, label: 'Записи', path: '/admin/appointments' },
  { icon: CreditCard, label: 'Платежи', path: '/admin/payments' },
  { icon: Megaphone, label: 'Реклама', path: '/admin/ads' },
  { icon: Award, label: 'Бейджи', path: '/admin/badges' },
  { icon: Percent, label: 'Акции', path: '/admin/promotions' },
  { icon: FileCheck, label: 'Модерация', path: '/admin/moderation' },
  { icon: MessageSquare, label: 'Отзывы', path: '/admin/reviews' },
  { icon: Tag, label: 'Промокоды', path: '/admin/promo' },
  { icon: FileText, label: 'Блог', path: '/admin/blog' },
  { icon: ClipboardCheck, label: 'Валидация', path: '/admin/verification' },
  { icon: Shield, label: 'Пользователи', path: '/admin/users' },
  { icon: Settings, label: 'Настройки', path: '/admin/settings' },
];

export const AdminSidebar = () => {
  const { signOut } = useAuth();

  // Fetch pending applications count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-applications-count'],
    queryFn: async () => {
      const [doctorRes, clinicRes] = await Promise.all([
        supabase.from('doctor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('clinic_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);
      return (doctorRes.count || 0) + (clinicRes.count || 0);
    },
    refetchInterval: 30000,
  });

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <img src={prodentLogo} alt="PRODENT" className="w-10 h-10 object-contain" />
        </Link>
        <div>
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-[#00C6BB]">PRODENT</h1>
          </Link>
          <p className="text-sm text-slate-400">Админ-панель</p>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-[#00C6BB]/10 text-[#00C6BB]'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.path === '/admin/verification' && pendingCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Выход</span>
        </button>
      </div>
    </aside>
  );
};
