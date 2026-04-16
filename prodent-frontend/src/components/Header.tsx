import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Phone, User, LogOut, Stethoscope, CalendarDays, Shield, X, Search, Gift, Building2, ChevronRight, BookOpen, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import prodentLogo from "@/assets/prodent-logo.png";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

const Header = () => {
  const { user, signOut, loading } = useAuth();
  const { isDoctor, isClinicAdmin, isClinicManager, isAssistant, isAccountant, isSuperAdmin, doctorId } = useUserRole();
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const { displayName, avatarUrl, initials } = useProfile();
  
  const canAccessCRM = isDoctor || isClinicAdmin || isClinicManager || isAssistant || isAccountant || isSuperAdmin;

  // Fetch clinic info from database
  useEffect(() => {
    const fetchClinicData = async () => {
      if (!user?.id) {
        setClinicId(null);
        return;
      }

      // Fetch clinic ID for clinic admins
      if (isClinicAdmin) {
        const { data: membership } = await supabase
          .from('clinic_members')
          .select('clinic_id')
          .eq('user_id', user.id)
          .eq('role', 'clinic_admin')
          .maybeSingle();

        setClinicId(membership?.clinic_id || null);
      }
    };

    fetchClinicData();
  }, [user?.id, isClinicAdmin]);

  const navItems = [
    { to: "/search", label: t('nav.search'), icon: Search },
    { to: "/clinics", label: t('nav.clinics'), icon: Building2 },
    { to: "/articles", label: t('nav.articles'), icon: BookOpen },
    { to: "/promotions", label: t('nav.promotions'), icon: Gift },
    { to: "/about", label: t('nav.about'), icon: Info },
  ];

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-card/95 backdrop-blur-xl border-b border-border shadow-sm dark:bg-card/90" />
      
      <div className="container mx-auto px-2 md:px-4 relative">
        <div className="flex items-center justify-between h-12 md:h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center group relative z-10 flex-shrink-0">
            <img 
              src={prodentLogo} 
              alt="PRODENT" 
              className="h-8 md:h-10 lg:h-11 transition-transform duration-200 group-hover:scale-105 object-contain" 
            />
          </Link>

          {/* Desktop Navigation - Always single row */}
          <nav className="hidden md:flex items-center flex-shrink-0">
            <div className="flex items-center bg-gradient-to-r from-muted/80 to-muted/60 dark:from-muted/50 dark:to-muted/30 rounded-full p-0.5 border border-border/50 shadow-sm backdrop-blur-sm h-7 md:h-8 lg:h-9">
              {navItems.map((item) => {
                const isPromotion = item.to === "/promotions";
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "relative flex items-center gap-1 lg:gap-1.5 px-2 md:px-2.5 lg:px-3 h-full rounded-full text-[10px] md:text-[11px] lg:text-xs font-semibold transition-all duration-300 whitespace-nowrap",
                      isActiveRoute(item.to)
                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                        : "text-foreground/80 hover:text-foreground hover:bg-background/80"
                    )}
                  >
                    <item.icon className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 transition-transform duration-300 flex-shrink-0" />
                    <span>{item.label}</span>
                    {isPromotion && (
                      <span className="absolute -top-1 -right-0.5 px-0.5 md:px-1 py-px text-[6px] md:text-[7px] font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-sm animate-pulse">
                        HOT
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-1.5 lg:gap-2">
            {/* Phone - Desktop */}
            <a 
              href="tel:+998712000000" 
              className="hidden xl:flex items-center gap-1 px-2 lg:px-2.5 h-7 md:h-8 lg:h-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-200"
            >
              <Phone className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="text-[10px] md:text-[11px] lg:text-xs font-medium">+998 71 200 00 00</span>
            </a>

            <LanguageSwitcher />
            <ThemeToggle />

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-7 w-7">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm p-0">
                <SheetHeader className="p-4 border-b border-border/50">
                  <SheetTitle className="flex items-center">
                    <img src={prodentLogo} alt="PRODENT" className="h-8 object-contain" />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-4 gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                        isActiveRoute(item.to)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </Link>
                  ))}
                  
                  <div className="my-4 border-t border-border/50" />
                  
                  <a 
                    href="tel:+998712000000" 
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="font-medium">+998 71 200 00 00</span>
                  </a>
                </div>
              </SheetContent>
            </Sheet>

            {/* User Menu */}
            {loading ? (
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-7 md:h-8 lg:h-9 px-1.5 gap-1 rounded-full bg-muted/50 hover:bg-muted border border-border/50"
                  >
                    <Avatar className="w-5 h-5 md:w-6 md:h-6">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-tashkent-sky text-white text-[8px] md:text-[10px] font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] md:text-xs font-medium">
                      {initials}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
                  {/* Doctor: Show Profile + Panel */}
                  {isDoctor && (
                    <>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to={doctorId ? `/doctor/${doctorId}` : "/crm/profile"} className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <span>Мой профиль</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-oriental-emerald" />
                          </div>
                          <span>Панель врача</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {/* Clinic Admin: Show Profile + Panel */}
                  {isClinicAdmin && !isDoctor && (
                    <>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to={clinicId ? `/clinic/${clinicId}` : "/crm"} className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <span>Профиль клиники</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-oriental-emerald" />
                          </div>
                          <span>Панель клиники</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {/* Regular patients */}
                  {!isDoctor && !isClinicAdmin && (
                    <>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/patient/dashboard" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <span>Личный кабинет</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/patient/appointments" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-tashkent-sky/10 flex items-center justify-center">
                            <CalendarDays className="w-4 h-4 text-tashkent-sky" />
                          </div>
                          <span>Мои записи</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {/* Show CRM link only for staff roles who don't already have a primary CRM link */}
                  {canAccessCRM && !isDoctor && !isClinicAdmin && (
                    <>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-oriental-emerald" />
                          </div>
                          <span className="text-oriental-emerald font-medium">CRM клиники</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {isSuperAdmin && (
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link to="/admin" className="flex items-center gap-2 py-2">
                        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-destructive" />
                        </div>
                        <span className="text-destructive font-medium">Админ-панель</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem 
                    onClick={() => signOut()} 
                    className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                  >
                    <div className="flex items-center gap-2 py-1">
                      <LogOut className="w-4 h-4" />
                      <span>Выйти</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/auth">
                <Button 
                  size="sm" 
                  className="h-7 md:h-8 lg:h-9 px-2 md:px-3 lg:px-4 rounded-full bg-gradient-to-r from-primary to-tashkent-sky hover:opacity-90 transition-opacity shadow-md text-[10px] md:text-xs"
                >
                  <User className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
                  <span className="hidden sm:inline">Войти</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
