import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  LayoutDashboard, 
  CalendarDays, 
  FileHeart, 
  CreditCard,
  Users,
  MessageCircle,
  FolderOpen,
  Heart,
  Bell,
  LogOut,
  Moon,
  Sun,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { usePatientAccessRequests } from "@/hooks/useMedicalAccess";
import prodentLogo from "@/assets/prodent-logo.png";

export function PatientSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { displayName } = useProfile();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { data: accessRequests } = usePatientAccessRequests();
  
  const pendingAccessCount = accessRequests?.filter(r => r.status === 'pending').length || 0;

  const navigation = [
    { name: t('patient.dashboard'), href: "/patient/dashboard", icon: LayoutDashboard },
    { name: t('patient.appointments'), href: "/patient/appointments", icon: CalendarDays },
    { name: t('patient.medical'), href: "/patient/medical", icon: FileHeart },
    { name: "Доступ к медкарте", href: "/patient/access", icon: Shield, badge: pendingAccessCount },
    { name: t('patient.payments'), href: "/patient/billing", icon: CreditCard },
    { name: t('patient.doctors'), href: "/patient/my-doctors", icon: Users },
    { name: t('patient.messages'), href: "/patient/messages", icon: MessageCircle },
    { name: "Уведомления", href: "/patient/notifications", icon: Bell, badge: unreadCount },
    { name: t('patient.files'), href: "/patient/files", icon: FolderOpen },
    { name: t('patient.family'), href: "/patient/family", icon: Heart },
  ];

  return (
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-r border-border/50">
      <div className="p-6 border-b border-border/50">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img 
            src={prodentLogo} 
            alt="PRODENT" 
            className="h-10 object-contain"
          />
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-prodent-btn text-[15px] font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-medium hover:bg-primary/90"
                  : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                {item.name}
              </div>
              {item.badge && item.badge > 0 && (
                <Badge variant={isActive ? "secondary" : "destructive"} className="h-5 min-w-5 px-1.5 text-xs">
                  {item.badge > 99 ? "99+" : item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </Button>
      </div>
    </div>
  );
}
