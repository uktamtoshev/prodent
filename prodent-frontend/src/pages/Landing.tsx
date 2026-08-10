import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Features from "@/components/Features";
import TopDoctors from "@/components/TopDoctors";
import Promotions from "@/components/Promotions";
import Footer from "@/components/Footer";
import { DoctorAdBanner, ClinicAdBanner } from "@/components/ads/AdBanners";
import { Menu, Search, Shield, Star, Clock, ArrowRight, User, LogOut, Building2, Users, CalendarDays, FileText, Wallet, LayoutDashboard, Stethoscope, Sparkles, CheckCircle2, ChevronRight, Zap, Store } from "lucide-react";
import heroDoctorAvif768 from "@/assets/hero-doctor-768.avif";
import heroDoctorAvif1536 from "@/assets/hero-doctor-1536.avif";
import heroDoctorWebp768 from "@/assets/hero-doctor-768.webp";
import heroDoctorWebp1536 from "@/assets/hero-doctor-1536.webp";
import dashboardExample from "@/assets/crm-examples/dashboard-example.jpg";
import dentalChartExample from "@/assets/crm-examples/dental-chart-example.jpg";
import calendarExample from "@/assets/crm-examples/calendar-example.jpg";
import doctorProfileFeature from "@/assets/crm-examples/doctor-profile-feature.jpg";
import clinicManagementFeature from "@/assets/crm-examples/clinic-management-feature.jpg";
import patientDatabaseFeature from "@/assets/crm-examples/patient-database-feature.jpg";
import stepSearch from "@/assets/steps/step-search.jpg";
import stepProfile from "@/assets/steps/step-profile.jpg";
import stepBooking from "@/assets/steps/step-booking.jpg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PageMeta } from "@/components/PageMeta";
import { WebSiteSchema, OrganizationSchema } from "@/components/StructuredData";
import { BrandMark } from "@/components/shared/BrandMark";

type PublicStats = {
  doctors: number | null;
  rating: string | null;
  clinics: number | null;
};

type PublicStatsState = {
  status: "loading" | "ready" | "unavailable";
  values: PublicStats;
};

const Landing = () => {
  const { t } = useLanguage();
  const { user, signOut, loading } = useAuth();
  const { isDoctor, isClinicAdmin, isClinicManager, isAssistant, isAccountant, isSuperAdmin, isSeller, loading: roleLoading, doctorId } = useUserRole();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const { displayName, avatarUrl, initials } = useProfile();
  
  const canAccessCRM = isDoctor || isClinicAdmin || isClinicManager || isAssistant || isAccountant || isSuperAdmin;

  // These values are always real public aggregates. Loading and unavailable
  // states have their own presentation so a placeholder can never look like a
  // product metric.
  const [stats, setStats] = useState<PublicStatsState>({
    status: "loading",
    values: {
      doctors: null,
      rating: null,
      clinics: null,
    },
  });

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const [doctorsResult, clinicsResult, ratingResult] = await Promise.all([
          // Verified doctor count (public GET allowlist).
          supabase
            .from("doctors")
            .select("id", { count: "exact", head: true })
            .eq("is_verified", true),
          // Verified clinic count (public GET allowlist).
          supabase
            .from("clinics")
            .select("id", { count: "exact", head: true })
            .eq("is_verified", true),
          // Real average rating across doctors that actually have reviews.
          supabase
            .from("doctors")
            .select("rating, reviews_count")
            .eq("is_verified", true)
            .gt("reviews_count", 0)
            .limit(1000),
        ]);

        if (cancelled) return;

        let rating: string | null = null;
        const rated = ratingResult.error ? null : ratingResult.data;
        if (Array.isArray(rated) && rated.length > 0) {
          const sum = rated.reduce((acc: number, d: { rating?: number }) => acc + Number(d.rating || 0), 0);
          const avg = sum / rated.length;
          if (Number.isFinite(avg) && avg > 0) rating = avg.toFixed(1);
        }

        const values: PublicStats = {
          // Zero is valid, honest data and must not be replaced by a placeholder.
          doctors: !doctorsResult.error && typeof doctorsResult.count === "number"
            ? doctorsResult.count
            : null,
          rating,
          clinics: !clinicsResult.error && typeof clinicsResult.count === "number"
            ? clinicsResult.count
            : null,
        };
        const hasAnyValue = Object.values(values).some((value) => value !== null);

        setStats({
          status: hasAnyValue ? "ready" : "unavailable",
          values,
        });
      } catch {
        if (!cancelled) {
          setStats((current) => ({ ...current, status: "unavailable" }));
        }
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchClinicData = async () => {
      if (!user?.id) {
        setClinicId(null);
        return;
      }

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

  return (
    <div className="min-h-screen bg-background [&_a_button]:min-h-11 [&_a:has(>button)]:flex [&_a:has(>button)]:min-h-11">
      <PageMeta
        title={`${t("landing.heroTitle")} — PRODENT`}
        description={t("landing.heroSubtitle")}
        canonical="https://prodent.uz/"
      />
      <WebSiteSchema />
      <OrganizationSchema />
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex min-h-11 min-w-11 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BrandMark
                size="sm"
                iconClassName="sm:h-10 sm:w-10 md:h-12 md:w-12"
                wordClassName="text-base sm:text-xl md:text-2xl"
              />
            </Link>
            <div
              className="flex min-w-0 items-center gap-1 sm:gap-3 [&_button]:min-h-11 [&_button]:min-w-11"
              data-testid="landing-header-actions"
            >
              <LanguageSwitcher />
              <ThemeToggle />
              {!loading && (
                <>
                  {user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="min-h-11 gap-2 rounded-full border border-border/50 bg-muted/50 px-2 hover:bg-muted md:px-3">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="hidden sm:inline max-w-[160px] truncate text-sm font-medium">
                            {displayName}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 rounded-xl p-2 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:focus-visible:ring-2 [&_[role=menuitem]]:focus-visible:ring-ring"
                      >
                        {/* While the role resolves, show a spinner instead of the
                            patient catch-all below (otherwise a seller/doctor briefly
                            sees and can click the wrong "Личный кабинет"). */}
                        {roleLoading && (
                          <DropdownMenuItem disabled className="rounded-lg justify-center py-3">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </DropdownMenuItem>
                        )}
                        {/* Doctor: Show Profile + Panel */}
                        {isDoctor && (
                          <>
                            <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                              <Link to={doctorId ? `/doctor/${doctorId}` : "/crm/profile"} className="flex items-center gap-2 py-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <span>{t('nav.myProfile')}</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                              <Link to="/crm" className="flex items-center gap-2 py-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-primary" />
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
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-primary" />
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
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Store className="w-4 h-4 text-primary" />
                              </div>
                              <span>{t("nav.personalCabinet")}</span>
                            </Link>
                          </DropdownMenuItem>
                        )}

                        {/* Regular patients — only once the role has resolved, and
                            not for sellers (whose role loads asynchronously). */}
                        {!roleLoading && !isDoctor && !isClinicAdmin && !isSeller && (
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
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <CalendarDays className="w-4 h-4 text-primary" />
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
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-primary font-medium">{t('nav.crmClinic')}</span>
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
                    <Button asChild variant="ghost" size="sm" className="hidden min-h-11 sm:inline-flex">
                      <Link to="/auth" aria-label={t('nav.login')}>
                        {t('landing.login')}
                      </Link>
                    </Button>
                  )}
                </>
              )}
              <Button
                asChild
                size="sm"
                className="group relative hidden min-h-11 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 hover:from-primary/90 hover:to-primary/70 hover:shadow-lg hover:shadow-primary/30 sm:inline-flex"
              >
                <Link to="/search">
                  <Sparkles className="w-4 h-4 mr-1.5 group-hover:animate-pulse" />
                  {t('nav.search')}
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>

              {/* Mobile burger — the landing header is minimal, so the nav links
                  and (for guests) login live here on small screens. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:hidden"
                    aria-label={t("notifications.menuLabel")}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:focus-visible:ring-2 [&_[role=menuitem]]:focus-visible:ring-ring"
                >
                  <DropdownMenuItem asChild><Link to="/search">{t('nav.search')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/clinics">{t('nav.clinics')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/articles">{t('nav.articles')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/promotions">{t('nav.promotions')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/pricing">{t('nav.pricing')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/about">{t('nav.about')}</Link></DropdownMenuItem>
                  {!user && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/auth" className="font-medium text-primary" aria-label={t('nav.login')}>{t('nav.login')}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-20 relative overflow-hidden min-h-screen flex items-center">
        {/* Background gradient that matches white of image */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
        
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left: Text Content */}
            <div className="min-w-0 text-center [overflow-wrap:anywhere] lg:text-left order-2 lg:order-1">
              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-4 leading-tight">
                {t('landing.heroTitle')}
                <span className="block text-primary">{t('landing.heroHighlight')}</span>
              </h1>
              <p className="text-xl md:text-2xl font-medium text-foreground/80 mb-6">
                {t('landing.heroSubtitle')}
              </p>

              <p className="text-lg md:text-xl !font-normal !leading-relaxed text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                {t('landing.heroDescription')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
                <Button asChild size="lg" className="group relative min-h-14 h-auto max-w-full w-full whitespace-normal px-4 py-3 text-base sm:w-auto sm:px-8 rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-0.5">
                  <Link to="/search">
                    <span className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 sm:block" />
                    <Search className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    {t('landing.findDoctor')}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="group relative min-h-14 h-auto max-w-full w-full whitespace-normal px-4 py-3 text-base sm:w-auto sm:px-8 rounded-full border-2 border-primary/50 text-primary hover:border-primary hover:bg-primary/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
                  <Link to="/clinics">
                    <Building2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    {t('landing.viewClinics')}
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>

              {/* Real public aggregates. The fixed-height value row prevents the
                  hero from moving while the requests resolve. */}
              <div
                className="grid min-h-[4.75rem] max-w-md grid-cols-3 gap-4 md:gap-8 mx-auto lg:mx-0"
                data-testid="public-live-stats"
                role="status"
                aria-live="polite"
                aria-busy={stats.status === "loading"}
              >
                {stats.status === "loading" ? (
                  <>
                    <span className="sr-only">{t("common.loading")}</span>
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className={`text-center lg:text-left ${index === 1 ? "border-x border-border px-4" : ""}`}
                        aria-hidden="true"
                        data-testid="public-live-stat-skeleton"
                      >
                        <div className="h-10 md:h-11 flex items-center justify-center lg:justify-start">
                          <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
                        </div>
                        <div className="mt-1 h-4 w-16 animate-pulse rounded bg-muted/70 mx-auto lg:mx-0" />
                      </div>
                    ))}
                  </>
                ) : stats.status === "unavailable" ? (
                  <span className="sr-only">{t("common.error")}</span>
                ) : (
                  <>
                    <div className={stats.values.doctors === null ? "invisible" : "text-center lg:text-left"}>
                      <div className="h-10 md:h-11 text-3xl md:text-4xl font-bold text-foreground">
                        {stats.values.doctors}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('landing.statDoctors')}</div>
                    </div>
                    <div className={stats.values.rating === null ? "invisible" : "text-center border-x border-border px-4"}>
                      <div className="h-10 md:h-11 text-3xl md:text-4xl font-bold text-foreground">
                        {stats.values.rating}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('landing.statRating')}</div>
                    </div>
                    <div className={stats.values.clinics === null ? "invisible" : "text-center lg:text-left"}>
                      <div className="h-10 md:h-11 text-3xl md:text-4xl font-bold text-foreground">
                        {stats.values.clinics}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('nav.clinics')}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="order-1 lg:order-2 relative flex justify-center lg:justify-end">
              {/* Gradient overlay to blend with background */}
              <div className="relative aspect-[3/2] w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl">
                {/* Main image with fading edges */}
                <div className="relative h-full w-full">
                  <picture className="block h-full w-full">
                    <source
                      type="image/avif"
                      srcSet={`${heroDoctorAvif768} 768w, ${heroDoctorAvif1536} 1536w`}
                      sizes="(min-width: 1280px) 896px, (min-width: 1024px) 768px, 100vw"
                    />
                    <source
                      type="image/webp"
                      srcSet={`${heroDoctorWebp768} 768w, ${heroDoctorWebp1536} 1536w`}
                      sizes="(min-width: 1280px) 896px, (min-width: 1024px) 768px, 100vw"
                    />
                    <img 
                      src={heroDoctorWebp1536}
                      width={1536}
                      height={1024}
                      loading="eager"
                      {...{ fetchpriority: "high" }}
                      decoding="async"
                      alt="PRODENT - Стоматология" 
                      className="relative z-10 h-full w-full object-contain"
                      style={{
                        maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                      }}
                    />
                  </picture>
                  {/* Glow effect behind image */}
                  <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-75 -z-10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CRM Section - All in One with Images */}
      <section className="py-24 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 animate-fade-in">
              {t('landing.crmBadge')}
            </span>
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              {t('landing.crmTitle')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {t('landing.crmSubtitle')}
            </p>
          </div>

          {/* Feature 1: Doctor Profile - Image Left, Text Right */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20 max-w-6xl mx-auto">
            <div className="relative group order-2 lg:order-1">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 scale-95 group-hover:scale-100" />
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20 group-hover:-translate-y-2">
                <img 
                  src={doctorProfileFeature} 
                  alt="Профиль врача PRODENT" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm text-primary text-sm font-medium mb-2">
                    {t('landing.forDoctors')}
                  </span>
                  <p className="text-xl font-bold text-foreground">{t('landing.manageProfile')}</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-4">{t('landing.doctorProfile')}</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                {t('landing.doctorProfileDesc')}
              </p>
              <ul className="space-y-3">
                {[t('landing.doctorBullet1'), t('landing.doctorBullet2'), t('landing.doctorBullet3'), t('landing.doctorBullet4')].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 group/item p-2 rounded-xl hover:bg-primary/5 transition-colors cursor-default">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover/item:from-primary/30 group-hover/item:to-primary/20 transition-colors shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 2: Clinic Management - Text Left, Image Right */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20 max-w-6xl mx-auto">
            <div className="order-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium mb-4 shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4" />
                {t('landing.crmSystem')}
              </div>
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-105 transition-transform">
                  <Building2 className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-4">{t('landing.clinicManagement')}</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                {t('landing.clinicManagementDesc')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: CalendarDays, text: t('landing.clinicFeature1'), color: 'from-primary to-primary/70' },
                  { icon: Wallet, text: t('landing.clinicFeature2'), color: 'from-[hsl(var(--success-green))] to-[hsl(var(--success-green)/0.7)]' },
                  { icon: FileText, text: t('landing.clinicFeature3'), color: 'from-primary to-primary/70' },
                  { icon: LayoutDashboard, text: t('landing.clinicFeature4'), color: 'from-warning-amber to-warning-amber/70' }
                ].map((item, i) => (
                  <div key={i} className="group/item flex items-center gap-3 p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:bg-card transition-all duration-300 hover:-translate-y-0.5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md group-hover/item:scale-110 transition-transform`}>
                      <item.icon className="w-5 h-5 text-background" />
                    </div>
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative group order-2">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 scale-95 group-hover:scale-100" />
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border-2 border-primary/30 group-hover:border-primary/50 transition-all duration-500 group-hover:shadow-primary/30 group-hover:-translate-y-2">
                <img 
                  src={clinicManagementFeature} 
                  alt="Управление клиникой PRODENT" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm text-primary text-sm font-medium mb-2">
                    {t('landing.forClinics')}
                  </span>
                  <p className="text-xl font-bold text-foreground">{t('landing.fullClinicControl')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Patient Database - Image Left, Text Right */}
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="relative group order-2 lg:order-1">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 scale-95 group-hover:scale-100" />
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20 group-hover:-translate-y-2">
                <img 
                  src={patientDatabaseFeature} 
                  alt="База пациентов PRODENT" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm text-primary text-sm font-medium mb-2">
                    {t('landing.database')}
                  </span>
                  <p className="text-xl font-bold text-foreground">{t('landing.allPatientInfo')}</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-105 transition-transform">
                  <Users className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-4">{t('landing.patientDatabase')}</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                {t('landing.patientDatabaseDesc')}
              </p>
              <ul className="space-y-3">
                {[t('landing.patientBullet1'), t('landing.patientBullet2'), t('landing.patientBullet3'), t('landing.patientBullet4')].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 group/item p-2 rounded-xl hover:bg-primary/5 transition-colors cursor-default">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover/item:from-primary/30 group-hover/item:to-primary/20 transition-colors shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center mt-16">
            <Button asChild size="lg" className="group relative min-h-16 h-auto max-w-full whitespace-normal px-4 py-3 text-lg sm:px-12 rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-2xl shadow-primary/30 hover:shadow-3xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1">
              <Link to="/auth">
                <span className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 sm:block" />
                <Sparkles className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
                {t('landing.connectClinic')}
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>


      {/* CRM Screenshots Gallery */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              {t('landing.interfaceTitle')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('landing.interfaceSubtitle')}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Dashboard Screenshot */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={dashboardExample} 
                    alt="CRM Dashboard" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-primary" />
                    {t('landing.dashboardCardTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('landing.dashboardCardDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Dental Chart Screenshot */}
            <div className="group relative lg:-mt-8">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 bg-card shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg">
                    {t('landing.popular')}
                  </span>
                </div>
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={dentalChartExample} 
                    alt="Dental Chart" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {t('landing.dentalChartCardTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('landing.dentalChartCardDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Calendar Screenshot */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={calendarExample} 
                    alt="Calendar" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    {t('landing.scheduleCardTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('landing.scheduleCardDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA for clinics */}
          <div className="text-center mt-12">
            <Button asChild size="lg" className="min-h-14 h-auto max-w-full whitespace-normal px-4 py-3 text-base sm:px-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30">
              <Link to="/auth">
                {t('landing.connectClinic')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features — why PRODENT */}
      <Features />

      {/* Sponsored doctor + clinic banners — appear above the Top Doctors
          carousel so paid placements get prime visibility on the marketing
          home page. Falls back to demo content when no campaigns are live. */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            <DoctorAdBanner />
            <ClinicAdBanner />
          </div>
        </div>
      </section>

      {/* Top Doctors carousel */}
      <TopDoctors />

      {/* Promotions from clinics */}
      <Promotions />

      {/* How it works */}
      <section className="py-24 relative overflow-hidden bg-muted/30">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 right-0 aspect-square w-full max-w-[600px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              {t('landing.easyStart')}
            </span>
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              {t('landing.howItWorks')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              {t('landing.howItWorksSubtitle')}
            </p>
          </div>

          {/* Step 1: Search - Image Left */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24 max-w-6xl mx-auto">
            <div className="relative group">
              {/* Floating badge */}
              <div className="absolute -top-6 -left-2 z-20 sm:-left-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-xl shadow-primary/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  01
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={stepSearch} 
                  alt="Поиск врача" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
            
            <div className="lg:pl-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Search className="w-4 h-4" />
                {t('landing.stepLabel1')}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.step1Title')}</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                {t('landing.step1Desc')}
              </p>
              <ul className="space-y-3">
                {[t('landing.step1Bullet1'), t('landing.step1Bullet2'), t('landing.step1Bullet3')].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Step 2: Profile - Image Right */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24 max-w-6xl mx-auto">
            <div className="lg:pr-8 order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning-amber/10 text-warning-amber text-sm font-medium mb-4">
                <Star className="w-4 h-4" />
                {t('landing.stepLabel2')}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.step2Title')}</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                {t('landing.step2Desc')}
              </p>
              <ul className="space-y-3">
                {[t('landing.step2Bullet1'), t('landing.step2Bullet2'), t('landing.step2Bullet3')].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-warning-amber flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-background" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative group order-1 lg:order-2">
              {/* Floating badge */}
              <div className="absolute -top-6 -right-2 z-20 sm:-right-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning-amber to-warning-amber/70 flex items-center justify-center text-background text-2xl font-bold shadow-xl shadow-warning-amber/30 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  02
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-warning-amber/20 to-warning-amber/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={stepProfile} 
                  alt="Профиль врача" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Booking - Image Left */}
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="relative group">
              {/* Floating badge */}
              <div className="absolute -top-6 -left-2 z-20 sm:-left-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--success-green))] to-[hsl(var(--success-green)/0.7)] flex items-center justify-center text-background text-2xl font-bold shadow-xl shadow-[hsl(var(--success-green)/0.3)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  03
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--success-green)/0.2)] to-[hsl(var(--success-green)/0.1)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={stepBooking} 
                  alt="Онлайн запись" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
            
            <div className="lg:pl-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))] text-sm font-medium mb-4">
                <CalendarDays className="w-4 h-4" />
                {t('landing.stepLabel3')}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.step3Title')}</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                {t('landing.step3Desc')}
              </p>
              <ul className="space-y-3">
                {[t('landing.step3Bullet1'), t('landing.step3Bullet2'), t('landing.step3Bullet3')].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--success-green))] flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-background" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-20">
            <Button asChild size="lg" className="group relative min-h-16 h-auto max-w-full whitespace-normal px-4 py-3 text-lg sm:px-12 rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-2xl shadow-primary/30 hover:shadow-3xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1">
              <Link to="/search">
                <span className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 sm:block" />
                <Search className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                {t('landing.startSearch')}
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-lg opacity-90 mb-8">
              {t('landing.ctaSubtitle')}
            </p>
            <Button asChild size="lg" variant="secondary" className="min-h-14 h-auto max-w-full whitespace-normal px-4 py-3 text-base sm:px-8 rounded-full">
              <Link to="/search">
                {t('landing.startSearch')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
