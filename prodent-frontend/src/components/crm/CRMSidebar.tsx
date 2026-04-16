import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Package,
  FlaskConical,
  BarChart3,
  Bell,
  Settings,
  Stethoscope,
  User,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Globe,
  UserPlus,
  MessageCircle,
  ChevronLeft,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import prodentLogo from "@/assets/prodent-logo.png";
import { ClinicSwitcher } from "./ClinicSwitcher";
import { useClinic } from "@/contexts/ClinicContext";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage, Language, languageNames, languageFlags } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type MenuPermission = 'all' | 'schedule' | 'patients' | 'medical' | 'finance' | 'inventory' | 'laboratory' | 'reports' | 'settings' | 'clinic_finance' | 'services';

interface MenuItem {
  title: string;
  path: string;
  icon: any;
  permission: MenuPermission;
  group: 'main' | 'medical' | 'finance' | 'system';
}

const groupLabels: Record<string, string> = {
  main: 'ОСНОВНОЕ',
  medical: 'МЕДИЦИНА',
  finance: 'ФИНАНСЫ',
  system: 'СИСТЕМА',
};

const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  { title: t('crm.dashboard'), path: "/crm", icon: LayoutDashboard, permission: 'all', group: 'main' },
  { title: t('crm.schedule'), path: "/crm/schedule", icon: Calendar, permission: 'schedule', group: 'main' },
  { title: t('crm.patients'), path: "/crm/patients", icon: Users, permission: 'patients', group: 'main' },
  { title: t('crm.messages'), path: "/crm/messages", icon: MessageCircle, permission: 'all', group: 'main' },
  { title: t('crm.medicalRecords'), path: "/crm/medical-records", icon: FileText, permission: 'medical', group: 'medical' },
  { title: t('crm.services'), path: "/crm/services", icon: Stethoscope, permission: 'services', group: 'medical' },
  { title: t('crm.laboratory'), path: "/crm/laboratory", icon: FlaskConical, permission: 'laboratory', group: 'medical' },
  { title: t('crm.finance'), path: "/crm/finance", icon: DollarSign, permission: 'finance', group: 'finance' },
  { title: t('crm.billing') || 'Подписки', path: "/crm/billing", icon: CreditCard, permission: 'finance', group: 'finance' },
  { title: t('crm.inventory'), path: "/crm/inventory", icon: Package, permission: 'inventory', group: 'finance' },
  { title: t('crm.reports'), path: "/crm/reports", icon: BarChart3, permission: 'reports', group: 'finance' },
  { title: t('crm.notifications'), path: "/crm/notifications", icon: Bell, permission: 'all', group: 'system' },
  { title: t('crm.doctorRequests'), path: "/crm/doctor-requests", icon: UserPlus, permission: 'settings', group: 'system' },
  { title: t('crm.settings'), path: "/crm/settings", icon: Settings, permission: 'settings', group: 'system' },
  { title: t('crm.profile'), path: "/crm/profile", icon: User, permission: 'all', group: 'system' },
];

export function CRMSidebar() {
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const { currentClinic, clinics } = useClinic();
  const { unreadCount } = useNotifications();
  const { 
    role,
    loading: roleLoading,
    isSuperAdmin,
    isClinicAdmin,
    isClinicManager,
    isDoctor,
    isAssistant,
    canAccessFinance,
    canAccessClinicFinance,
    canAccessInventory,
    canAccessMedicalRecords,
    canAccessSchedule,
    canAccessPatients,
    canAccessSettings,
    canAccessClinicReports,
  } = useUserRole();

  const canAccessLaboratory = isSuperAdmin || isClinicAdmin || isDoctor || isAssistant;
  const canAccessServices = isSuperAdmin || isClinicAdmin || isClinicManager || isDoctor;

  const allMenuItems = getMenuItems(t);

  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      switch (item.permission) {
        case 'all': return true;
        case 'schedule': return canAccessSchedule;
        case 'patients': return canAccessPatients;
        case 'medical': return canAccessMedicalRecords;
        case 'finance': return canAccessFinance;
        case 'clinic_finance': return canAccessClinicFinance;
        case 'inventory': return canAccessInventory;
        case 'laboratory': return canAccessLaboratory;
        case 'reports': return canAccessClinicReports;
        case 'settings': return canAccessSettings;
        case 'services': return canAccessServices;
        default: return true;
      }
    });
  }, [allMenuItems, canAccessFinance, canAccessClinicFinance, canAccessInventory, canAccessMedicalRecords, canAccessSchedule, canAccessPatients, canAccessSettings, canAccessClinicReports, canAccessLaboratory, canAccessServices]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = { main: [], medical: [], finance: [], system: [] };
    menuItems.forEach(item => {
      if (groups[item.group]) groups[item.group].push(item);
    });
    return groups;
  }, [menuItems]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Ошибка", description: "Не удалось выйти из системы", variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const getRoleBadge = () => {
    const labels: Record<string, string> = {
      super_admin: 'Админ', clinic_admin: 'Админ', clinic_manager: 'Менеджер',
      doctor: 'Врач', assistant: 'Ассистент', accountant: 'Бухгалтер', patient: 'Пациент',
    };
    return role ? labels[role] || role : '';
  };

  const NavItem = ({ item }: { item: MenuItem }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const showBadge = item.path === "/crm/notifications" && unreadCount > 0;

    const content = (
      <Link
        to={item.path}
        onClick={() => setIsMobileMenuOpen(false)}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 relative",
          "hover:bg-primary/5 group",
          isCollapsed && "justify-center px-2",
          isActive && "bg-primary/10 text-primary font-medium"
        )}
      >
        <div className="relative shrink-0">
          <Icon className={cn(
            "w-[18px] h-[18px] transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {showBadge && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "+" : unreadCount}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <span className={cn(
            "text-[13px] truncate transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}>
            {item.title}
          </span>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("flex items-center justify-between p-3 border-b border-border/40", isCollapsed && "justify-center")}>
        {!isCollapsed ? (
          <Link to="/" className="flex items-center gap-2">
            <img src={prodentLogo} alt="PRODENT" className="h-7 object-contain" />
          </Link>
        ) : (
          <Link to="/">
            <img src={prodentLogo} alt="PRODENT" className="h-6 object-contain" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn("h-7 w-7 text-muted-foreground hover:text-foreground hidden lg:flex", isCollapsed && "rotate-180")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Clinic Switcher */}
      {clinics.length > 0 && !isCollapsed && (
        <div className="px-2.5 py-2 border-b border-border/40">
          <ClinicSwitcher />
        </div>
      )}

      {/* Navigation */}
      <TooltipProvider>
        <ScrollArea className="flex-1 py-2">
          <nav className={cn("space-y-4", isCollapsed ? "px-1.5" : "px-2")}>
            {roleLoading ? (
              <div className="space-y-2 px-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : (
              Object.entries(groupedItems).map(([group, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={group} className="space-y-0.5">
                    {!isCollapsed && (
                      <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        {groupLabels[group]}
                      </p>
                    )}
                    {items.map((item) => <NavItem key={item.path} item={item} />)}
                  </div>
                );
              })
            )}
          </nav>
        </ScrollArea>
      </TooltipProvider>

      {/* Footer */}
      <div className={cn("border-t border-border/40 p-2 space-y-1", isCollapsed && "p-1.5")}>
        {/* Theme Toggle */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Светлая тема</span>
            </div>
            <Switch
              checked={theme === "light"}
              onCheckedChange={() => toggleTheme()}
              className="scale-75"
            />
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-full">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Сменить тему</TooltipContent>
          </Tooltip>
        )}

        {/* User Info & Logout */}
        {!isCollapsed ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {getRoleBadge().slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{currentClinic?.name || 'Клиника'}</p>
              <p className="text-[10px] text-muted-foreground">{getRoleBadge()}</p>
            </div>
          </div>
        ) : null}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              className={cn(
                "text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                isCollapsed ? "h-8 w-full" : "w-full justify-start gap-2 h-8"
              )}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="text-xs">Выход</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">Выход</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );

  const sidebarWidth = isCollapsed ? "w-14" : "w-56";

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card/95 backdrop-blur-sm border-border/50 shadow-sm h-9 w-9"
      >
        {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-56 z-40 lg:hidden",
        "bg-card border-r border-border/50 shadow-xl transition-transform duration-200",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed top-0 left-0 h-full z-30 transition-all duration-200",
        "bg-card/95 backdrop-blur-sm border-r border-border/40",
        sidebarWidth
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
