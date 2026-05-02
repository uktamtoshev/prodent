import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Features from "@/components/Features";
import TopDoctors from "@/components/TopDoctors";
import Promotions from "@/components/Promotions";
import Footer from "@/components/Footer";
import { Search, Shield, Star, Clock, ArrowRight, User, LogOut, Building2, Users, CalendarDays, FileText, Wallet, LayoutDashboard, Stethoscope, Sparkles, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import prodentLogo from "@/assets/prodent-logo.png";
import heroDoctor from "@/assets/hero-doctor.png";
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
import { supabase } from "@/integrations/api/client";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PageMeta } from "@/components/PageMeta";
import { WebSiteSchema } from "@/components/StructuredData";

const Landing = () => {
  const { t } = useLanguage();
  const { user, signOut, loading } = useAuth();
  const { isDoctor, isClinicAdmin, isClinicManager, isAssistant, isAccountant, isSuperAdmin, doctorId } = useUserRole();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const { displayName, avatarUrl, initials } = useProfile();
  
  const canAccessCRM = isDoctor || isClinicAdmin || isClinicManager || isAssistant || isAccountant || isSuperAdmin;

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
    <div className="min-h-screen bg-background">
      <PageMeta
        title="PRODENT — Премиум портал стоматологов Центральной Азии"
        description="Найдите лучшего стоматолога за 7 секунд. 500+ проверенных врачей в Узбекистане. Онлайн-запись, реальные отзывы и фото работ."
        canonical="https://prodent.uz/"
      />
      <WebSiteSchema />
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={prodentLogo} alt="PRODENT" className="h-20 md:h-24 object-contain" />
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {!loading && (
                <>
                  {user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 rounded-full bg-muted/50 hover:bg-muted border border-border/50 px-2 md:px-3">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white text-xs font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="hidden sm:inline max-w-[160px] truncate text-sm font-medium">
                            {displayName}
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
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-emerald-600" />
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
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-emerald-600" />
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
                                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                  <CalendarDays className="w-4 h-4 text-sky-600" />
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
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span className="text-emerald-600 font-medium">CRM клиники</span>
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
                      <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                        {t('landing.login')}
                      </Button>
                    </Link>
                  )}
                </>
              )}
              <Link to="/search">
                <Button size="sm" className="group relative rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300">
                  <Sparkles className="w-4 h-4 mr-1.5 group-hover:animate-pulse" />
                  Найти врача
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
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
            <div className="text-center lg:text-left order-2 lg:order-1">
              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-4 leading-tight">
                {t('landing.heroTitle')}
                <span className="block text-primary">{t('landing.heroHighlight')}</span>
              </h1>
              <p className="text-xl md:text-2xl font-medium text-foreground/80 mb-6">
                {t('landing.heroSubtitle')}
              </p>

              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                {t('landing.heroDescription')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
                <Link to="/search">
                  <Button size="lg" className="group relative w-full sm:w-auto h-14 px-8 text-base rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-0.5">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <Search className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    {t('landing.findDoctor')}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/clinics">
                  <Button size="lg" variant="outline" className="group relative w-full sm:w-auto h-14 px-8 text-base rounded-full border-2 border-primary/50 text-primary hover:border-primary hover:bg-primary/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
                    <Building2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    {t('landing.viewClinics')}
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-md mx-auto lg:mx-0">
                <div className="text-center lg:text-left">
                  <div className="text-3xl md:text-4xl font-bold text-foreground">500+</div>
                  <div className="text-sm text-muted-foreground">{t('landing.statDoctors')}</div>
                </div>
                <div className="text-center border-x border-border px-4">
                  <div className="text-3xl md:text-4xl font-bold text-foreground">4.9</div>
                  <div className="text-sm text-muted-foreground">{t('landing.statRating')}</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-3xl md:text-4xl font-bold text-foreground">10K+</div>
                  <div className="text-sm text-muted-foreground">{t('landing.statAppointments')}</div>
                </div>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="order-1 lg:order-2 relative flex justify-center lg:justify-end">
              {/* Gradient overlay to blend with background */}
              <div className="relative">
                {/* Main image with fading edges */}
                <div className="relative">
                  <img 
                    src={heroDoctor} 
                    alt="PRODENT - Стоматология" 
                    className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl h-auto relative z-10"
                    style={{
                      maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                    }}
                  />
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
                    Для врачей
                  </span>
                  <h4 className="text-xl font-bold text-foreground">Управляйте своим профилем</h4>
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
              <h3 className="text-3xl font-bold mb-4">Профиль врача</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                Создайте профессиональный профиль с портфолио работ, сертификатами и отзывами пациентов. Привлекайте новых клиентов через онлайн-записи.
              </p>
              <ul className="space-y-3">
                {['Фото работ до/после', 'Онлайн-запись пациентов', 'Реальные отзывы', 'Сертификаты и награды'].map((item, i) => (
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
                CRM система
              </div>
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-105 transition-transform">
                  <Building2 className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-4">Управление клиникой</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                Единая платформа для всех процессов: от записи до финансов и аналитики. Контролируйте все аспекты работы клиники.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: CalendarDays, text: 'Расписание и очередь', color: 'from-blue-500 to-cyan-500' },
                  { icon: Wallet, text: 'Финансы и касса', color: 'from-emerald-500 to-teal-500' },
                  { icon: FileText, text: 'Медицинские карты', color: 'from-violet-500 to-purple-500' },
                  { icon: LayoutDashboard, text: 'Аналитика и отчёты', color: 'from-amber-500 to-orange-500' }
                ].map((item, i) => (
                  <div key={i} className="group/item flex items-center gap-3 p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:shadow-lg hover:bg-card transition-all duration-300 hover:-translate-y-0.5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md group-hover/item:scale-110 transition-transform`}>
                      <item.icon className="w-5 h-5 text-white" />
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
                    Для клиник
                  </span>
                  <h4 className="text-xl font-bold text-foreground">Полный контроль над клиникой</h4>
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
                    База данных
                  </span>
                  <h4 className="text-xl font-bold text-foreground">Вся информация о пациентах</h4>
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
              <h3 className="text-3xl font-bold mb-4">База пациентов</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                Полная история лечения, зубная карта и планы лечения в одном месте. Мгновенный доступ ко всей информации о пациенте.
              </p>
              <ul className="space-y-3">
                {['Интерактивная зубная карта', 'История визитов', 'Планы лечения', 'Документы и снимки'].map((item, i) => (
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
            <Link to="/auth">
              <Button size="lg" className="group relative h-16 px-12 text-lg rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-2xl shadow-primary/30 hover:shadow-3xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Sparkles className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
                {t('landing.connectClinic')}
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* CRM Screenshots Gallery */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Интерфейс системы
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Современный и интуитивно понятный интерфейс для эффективной работы
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
                    Панель управления
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Статистика, записи и аналитика в одном месте
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
                    Популярно
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
                    Зубная карта пациента
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Интерактивная карта с историей лечения
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
                    Расписание
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Удобное управление записями врачей
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA for clinics */}
          <div className="text-center mt-12">
            <Link to="/auth">
              <Button size="lg" className="h-14 px-8 text-base rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30">
                {t('landing.connectClinic')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features — why PRODENT */}
      <Features />

      {/* Top Doctors carousel */}
      <TopDoctors />

      {/* Promotions from clinics */}
      <Promotions />

      {/* How it works */}
      <section className="py-24 relative overflow-hidden bg-muted/30">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Простой старт
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
              <div className="absolute -top-6 -left-6 z-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-blue-500/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  01
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={stepSearch} 
                  alt="Поиск врача" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
            
            <div className="lg:pl-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium mb-4">
                <Search className="w-4 h-4" />
                Шаг 1
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Найдите врача</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Используйте удобные фильтры для поиска идеального специалиста. Выберите специальность, город, рейтинг и ценовой диапазон.
              </p>
              <ul className="space-y-3">
                {['Фильтр по специальности', 'Поиск по городу и району', 'Сортировка по рейтингу'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium mb-4">
                <Star className="w-4 h-4" />
                Шаг 2
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Изучите профиль</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Посмотрите полный профиль врача с фотографиями работ, реальными отзывами пациентов и сертификатами.
              </p>
              <ul className="space-y-3">
                {['Портфолио с фото до/после', 'Реальные отзывы пациентов', 'Сертификаты и награды'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative group order-1 lg:order-2">
              {/* Floating badge */}
              <div className="absolute -top-6 -right-6 z-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-amber-500/30 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  02
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
              <div className="absolute -top-6 -left-6 z-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-emerald-500/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  03
                </div>
              </div>
              
              {/* Image container */}
              <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-border/50 group-hover:border-primary/30 transition-all duration-500 group-hover:shadow-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={stepBooking} 
                  alt="Онлайн запись" 
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
            
            <div className="lg:pl-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4">
                <CalendarDays className="w-4 h-4" />
                Шаг 3
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">Запишитесь онлайн</h3>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Выберите удобное время и запишитесь к врачу в пару кликов. Получите мгновенное подтверждение записи.
              </p>
              <ul className="space-y-3">
                {['Выбор удобного времени', 'Мгновенное подтверждение', 'Напоминание о визите'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-20">
            <Link to="/search">
              <Button size="lg" className="group relative h-16 px-12 text-lg rounded-full bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden shadow-2xl shadow-primary/30 hover:shadow-3xl hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-1">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Search className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                Начать поиск врача
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
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
            <Link to="/search">
              <Button size="lg" variant="secondary" className="h-14 px-8 text-base rounded-full">
                {t('landing.startSearch')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
