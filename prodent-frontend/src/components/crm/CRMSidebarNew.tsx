import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  MessageCircle,
  UserPlus,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
  CheckSquare,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useModulePermissions, ModuleName } from "@/hooks/useModulePermissions";
import { useNotifications } from "@/hooks/useNotifications";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import prodentLogo from "@/assets/prodent-logo.png";
import { ClinicSwitcher } from "./ClinicSwitcher";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Flat menu items (no groups)
const menuItems = [
  { title: "Главная", path: "/crm", icon: LayoutDashboard, permission: "all" as const },
  { title: "Расписание", path: "/crm/schedule", icon: Calendar, permission: "schedule" as const },
  { title: "Пациенты", path: "/crm/patients", icon: Users, permission: "patients" as const },
  { title: "Сообщения", path: "/crm/messages", icon: MessageCircle, permission: "all" as const },
  { title: "Задачи", path: "/crm/tasks", icon: CheckSquare, permission: "schedule" as const },
  { title: "Медкарты", path: "/crm/medical-records", icon: FileText, permission: "medical" as const },
  { title: "Услуги", path: "/crm/services", icon: Stethoscope, permission: "services" as const },
  { title: "Лаборатория", path: "/crm/laboratory", icon: FlaskConical, permission: "laboratory" as const },
  { title: "Финансы", path: "/crm/finance", icon: DollarSign, permission: "finance" as const },
  { title: "Подписки", path: "/crm/billing", icon: DollarSign, permission: "finance" as const },
  { title: "Склад", path: "/crm/inventory", icon: Package, permission: "inventory" as const },
  { title: "Отчёты", path: "/crm/reports", icon: BarChart3, permission: "reports" as const },
  { title: "Заявки врачей", path: "/crm/doctor-requests", icon: UserPlus, permission: "settings" as const },
  { title: "Уведомления", path: "/crm/notifications", icon: Bell, permission: "all" as const },
  { title: "Настройки", path: "/crm/settings", icon: Settings, permission: "settings" as const },
  { title: "Профиль", path: "/crm/profile", icon: User, permission: "all" as const },
];

type Permission = "all" | "schedule" | "patients" | "medical" | "finance" | "inventory" | "laboratory" | "reports" | "settings" | "services";

export function CRMSidebarNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { clinics } = useClinic();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const {
    role,
    isSuperAdmin,
    isClinicAdmin,
    isClinicManager,
    isDoctor,
    isAssistant,
    canAccessFinance,
    canAccessInventory,
    canAccessMedicalRecords,
    canAccessSchedule,
    canAccessPatients,
    canAccessSettings,
    canAccessClinicReports,
  } = useUserRole();

  const { canView } = useModulePermissions();

  const canAccessLaboratory = isSuperAdmin || isClinicAdmin || isDoctor || isAssistant;
  const canAccessServices = isSuperAdmin || isClinicAdmin || isClinicManager || isDoctor;

  // Map sidebar permission strings to module permission checks
  const MODULE_MAP: Record<string, ModuleName> = {
    schedule: "schedule",
    patients: "patients",
    medical: "medical_records",
    finance: "finance",
    inventory: "inventory",
    laboratory: "laboratory",
    reports: "reports",
    settings: "settings",
    services: "services",
  };

  const checkPermission = (permission: Permission): boolean => {
    // "all" is always accessible
    if (permission === "all") return true;

    // Use granular module permissions
    const moduleName = MODULE_MAP[permission];
    if (moduleName) {
      return canView(moduleName);
    }

    return true;
  };

  const getRoleName = (): string => {
    const roleLabels: Record<string, string> = {
      super_admin: "Супер-админ",
      clinic_admin: "Администратор",
      clinic_manager: "Менеджер",
      doctor: "Врач",
      assistant: "Ассистент",
      accountant: "Бухгалтер",
      patient: "Пациент",
    };
    return role ? roleLabels[role] || role : "";
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    } else {
      navigate("/");
    }
  };

  const { displayName, avatarUrl, initials } = useProfile();
  const isLight = theme === "light";

  const visibleItems = menuItems.filter((item) => checkPermission(item.permission));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header with Logo & Collapse */}
      <div className={cn(
        "px-2 py-2 flex items-center border-b border-border",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img src={prodentLogo} alt="PRODENT" className="h-5 w-5 object-contain" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">На главную</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <img src={prodentLogo} alt="PRODENT" className="h-6 object-contain" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(true)}
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* User Profile - compact */}
      <div className={cn("px-2 py-1.5 border-b border-border", collapsed && "px-1")}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 mx-auto border border-primary/20 cursor-pointer hover:border-primary/40 transition-colors">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="font-medium">{displayName}</p>
              <p className="text-muted-foreground">{getRoleName()}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-primary/20 shrink-0">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{getRoleName()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Clinic Switcher - compact */}
      {clinics.length > 0 && (
        <div className={cn("px-2 py-1.5 border-b border-border", collapsed && "px-1")}>
          <ClinicSwitcher collapsed={collapsed} />
        </div>
      )}

      {/* Navigation - flat list, no scroll */}
      <nav className="flex-1 px-1 py-1">
        <div className="space-y-px">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const badge = item.path === "/crm/notifications" ? unreadCount : undefined;
            
            const content = (
              <NavLink
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150",
                  "text-foreground/70 hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-1.5"
                )}
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <div className="relative shrink-0">
                  <Icon className="w-4 h-4 transition-colors" />
                  {badge && badge > 0 && collapsed && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                      {badge > 9 ? "+" : badge}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <>
                    <span className="text-xs truncate">{item.title}</span>
                    {badge && badge > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-3.5 min-w-3.5 px-1 text-[8px] font-bold"
                      >
                        {badge > 99 ? "99+" : badge}
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {item.title}
                    {badge && badge > 0 && (
                      <Badge variant="destructive" className="ml-2 h-3 px-1 text-[8px]">
                        {badge}
                      </Badge>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{content}</div>;
          })}
        </div>
      </nav>

      {/* Footer - Theme & Logout */}
      <div className={cn("border-t border-border p-1.5", collapsed ? "space-y-0.5" : "")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-0.5">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                >
                  {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {isLight ? "Тёмная тема" : "Светлая тема"}
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Выход</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(false)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[10px] gap-1"
              onClick={() => setTheme(isLight ? "dark" : "light")}
            >
              {isLight ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3 text-amber-500" />}
              {isLight ? "Тёмная" : "Светлая"}
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
            >
              <LogOut className="w-3 h-3" />
              Выход
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* Mobile Menu Button */}
      <Button
        onClick={() => setMobileOpen(!mobileOpen)}
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden h-9 w-9 bg-background border-border shadow-sm"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-56 z-40 lg:hidden",
          "border-r border-border shadow-xl",
          "transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: 'white' }}
      >
        <div className="h-full w-full dark:bg-zinc-900 bg-white">
          <SidebarContent />
        </div>
      </aside>

      {/* Desktop Sidebar - Fully opaque solid background */}
      <aside
        className={cn(
          "hidden lg:flex fixed top-0 left-0 h-full z-30",
          "border-r border-border",
          "transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
        style={{ backgroundColor: 'white' }}
      >
        <div className="h-full w-full dark:bg-zinc-900 bg-white">
          <SidebarContent />
        </div>
      </aside>
    </TooltipProvider>
  );
}
