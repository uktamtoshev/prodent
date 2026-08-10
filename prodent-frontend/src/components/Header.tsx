import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Phone, User, LogOut, Stethoscope, CalendarDays, Shield, X, Search, Gift, Building2, ChevronRight, BookOpen, Info, Store, FlaskConical } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { BrandMark } from "@/components/shared/BrandMark";

const Header = () => {
  const { user, signOut, loading } = useAuth();
  const { isDoctor, isClinicAdmin, isClinicManager, isAssistant, isAccountant, isSuperAdmin, isSeller, isTechnician, loading: roleLoading, doctorId } = useUserRole();
  const { t } = useLanguage();
  const location = useLocation();
  const authHref =
    location.pathname === "/auth"
      ? "/auth"
      : `/auth?returnTo=${encodeURIComponent(
          `${location.pathname}${location.search}${location.hash}`,
        )}`;
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
    { to: "/pricing", label: t('nav.pricing'), icon: Gift },
    { to: "/about", label: t('nav.about'), icon: Info },
  ];

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-card/95 backdrop-blur-xl border-b border-border shadow-sm dark:bg-card/90" />
      
      <div className="container mx-auto px-2 md:px-4 relative">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="group relative z-10 flex min-h-11 min-w-11 flex-shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="PRODENT — главная"
          >
            <BrandMark
              size="sm"
              className="transition-transform duration-200 group-hover:scale-105"
              iconClassName="md:h-10 md:w-10 lg:h-11 lg:w-11"
              wordClassName="md:text-xl"
            />
          </Link>

          {/* Desktop Navigation - Always single row */}
          <nav className="hidden md:flex items-center flex-shrink-0">
            <div className="flex h-11 items-center rounded-full border border-border/50 bg-gradient-to-r from-muted/80 to-muted/60 p-0.5 shadow-sm backdrop-blur-sm dark:from-muted/50 dark:to-muted/30">
              {navItems.map((item) => {
                const isPromotion = item.to === "/promotions";
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "relative flex h-full min-h-11 min-w-11 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-all duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:gap-1.5 lg:px-3",
                      isActiveRoute(item.to)
                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                        : "text-foreground/80 hover:text-foreground hover:bg-background/80"
                    )}
                  >
                    <item.icon className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 transition-transform duration-300 flex-shrink-0" />
                    <span>{item.label}</span>
                    {isPromotion && (
                      <>
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive shadow-sm"
                          aria-hidden="true"
                        />
                        <span className="sr-only">{t('nav.hot')}</span>
                      </>
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
              className="hidden h-11 min-w-11 items-center gap-1 rounded-full bg-primary/10 px-2 text-primary transition-colors duration-200 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:px-2.5 xl:flex"
            >
              <Phone className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="text-xs font-medium">+998 71 200 00 00</span>
            </a>

            <LanguageSwitcher />
            {/* Theme toggle hidden for pilot — dark mode is broken; app is forced light. */}

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 md:hidden"
                  aria-label={t('nav.menu')}
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm p-0">
                <SheetHeader className="p-4 border-b border-border/50">
                  <SheetTitle className="flex items-center">
                    <BrandMark size="sm" />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-4 gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-11 min-w-11 items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                    className="flex min-h-11 min-w-11 items-center gap-3 rounded-xl bg-primary/10 px-4 py-3 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="font-medium">+998 71 200 00 00</span>
                  </a>
                </div>
              </SheetContent>
            </Sheet>

            {/* User Menu */}
            {loading ? (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-11 min-w-11 gap-1 rounded-full border border-border/50 bg-muted/50 px-2 hover:bg-muted"
                  >
                    <Avatar className="w-5 h-5 md:w-6 md:h-6">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-tashkent-sky text-xs font-medium text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">
                      {initials}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl p-2 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:focus-visible:ring-2 [&_[role=menuitem]]:focus-visible:ring-ring"
                >
                  {/* While the role is still resolving, show a spinner instead of
                      the patient catch-all below — otherwise a seller/doctor/etc.
                      briefly sees (and can click) the wrong "Личный кабинет". */}
                  {roleLoading && (
                    <DropdownMenuItem disabled className="rounded-lg justify-center py-3">
                      <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </DropdownMenuItem>
                  )}
                  {/* Doctor: Show Profile + Panel */}
                  {isDoctor && (
                    <>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm/profile" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <span>{t('nav.myProfile')}</span>
                        </Link>
                      </DropdownMenuItem>
                      {doctorId && (
                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                          <Link to={`/doctor/${doctorId}`} className="flex items-center gap-2 py-2">
                            <div className="w-8 h-8 rounded-lg bg-secondary/40 flex items-center justify-center">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <span>{t('nav.publicCard')}</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-oriental-emerald" />
                          </div>
                          <span>{t('nav.doctorPanel')}</span>
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
                          <span>{t('nav.clinicProfile')}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/crm" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-oriental-emerald" />
                          </div>
                          <span>{t('nav.clinicPanel')}</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {/* Seller: marketplace cabinet */}
                  {isSeller && !isDoctor && !isClinicAdmin && (
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link to="/seller" className="flex items-center gap-2 py-2">
                        <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                          <Store className="w-4 h-4 text-oriental-emerald" />
                        </div>
                        <span>{t('nav.personalCabinet')}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* Technician: dental-lab cabinet */}
                  {isTechnician && !isDoctor && !isClinicAdmin && !isSeller && (
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link to="/technician" className="flex items-center gap-2 py-2">
                        <div className="w-8 h-8 rounded-lg bg-oriental-emerald/10 flex items-center justify-center">
                          <FlaskConical className="w-4 h-4 text-oriental-emerald" />
                        </div>
                        <span>{t('nav.personalCabinet')}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* Regular patients — only once the role has resolved, so a
                      seller/technician (role loads async) is never offered the patient cabinet. */}
                  {!roleLoading && !isDoctor && !isClinicAdmin && !isSeller && !isTechnician && (
                    <>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/patient/dashboard" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <span>{t('nav.personalCabinet')}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                        <Link to="/patient/appointments" className="flex items-center gap-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-tashkent-sky/10 flex items-center justify-center">
                            <CalendarDays className="w-4 h-4 text-tashkent-sky" />
                          </div>
                          <span>{t('nav.myAppointments')}</span>
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
                          <span className="text-oriental-emerald font-medium">{t('nav.crmClinic')}</span>
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
                        <span className="text-destructive font-medium">{t('nav.adminPanel')}</span>
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
                      <span>{t('nav.logout')}</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                asChild
                size="sm"
                className="h-11 min-w-11 rounded-full bg-gradient-to-r from-primary to-tashkent-sky px-3 text-xs shadow-md transition-opacity hover:opacity-90 lg:px-4"
              >
                <Link to={authHref} aria-label={t('nav.login')}>
                  <User className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
                  <span className="hidden sm:inline">{t('nav.login')}</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
