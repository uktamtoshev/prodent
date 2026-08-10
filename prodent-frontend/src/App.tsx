import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { analytics } from "@/lib/analytics";
import { getAppTranslationNamespaces } from "@/i18n/route-namespaces";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ClinicProvider } from "@/contexts/ClinicContext";
// Standalone marketplace (own shell, outside the cabinet) — see ops/marketplace-standalone-plan.md
// The old in-cabinet DoctorMarket is retired; /doctor/market now redirects to /market.
import { MarketCartProvider } from "./contexts/MarketCartContext";
import { MarketLayout } from "./components/market/MarketLayout";
import { MARKET_ROUTES } from "./lib/market-routes";

// Standalone Jobs module (own shell, outside the cabinet) — see ops/jobs-module-spec.md
// Doctors-and-clinics-only labour marketplace. Future: work.prodent.uz.
import { JobsLayout } from "./components/jobs/JobsLayout";
import { JOBS_ROUTES } from "./lib/jobs-routes";

// Standalone Склад module (own shell, outside the cabinet) — see ops/sklad-module-spec.md
// Warehouse/inventory: clinic-staff space + doctor personal space. Future: sklad.prodent.uz.
import { SkladLayout } from "./components/sklad/SkladLayout";
import { SKLAD_ROUTES } from "./lib/sklad-routes";

// Standalone Лаборатория module (own shell, outside the cabinet) — clinic/doctor
// order lab work from technicians. Заказы + каталог лабораторий. Future: lab.prodent.uz.
import { LabLayout } from "./components/lab/LabLayout";
import { LAB_ROUTES } from "./lib/lab-routes";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteAccessibility } from "./components/system/RouteAccessibility";
import { accountantRouteElements } from "./routes/accountant-routes";
import { assistantRouteElements } from "./routes/assistant-routes";
import { clinicAdminRouteElements } from "./routes/clinic-admin-routes";
import { crmRouteElements } from "./routes/crm-routes";
import { doctorRouteElements } from "./routes/doctor-routes";
import { managerRouteElements } from "./routes/manager-routes";
import { AdminRouteBoundary } from "./routes/AdminRouteBoundary";

// Each page is downloaded only when its route is opened. Keeping providers and
// route shells eager preserves navigation behaviour while removing unrelated
// product areas from the initial bundle.
const Search = lazy(() => import("./pages/Search"));
const Landing = lazy(() => import("./pages/Landing"));
const Clinics = lazy(() => import("./pages/Clinics"));
const ClinicProfile = lazy(() => import("./pages/ClinicProfile"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Profile = lazy(() => import("./pages/Profile"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Promotions = lazy(() => import("./pages/Promotions"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const Articles = lazy(() => import("./pages/Articles"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const About = lazy(() => import("./pages/About"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Pricing = lazy(() => import("./pages/Pricing"));
const TreatmentPlanPublic = lazy(() => import("./pages/TreatmentPlanPublic"));
const StaffInvitationDecision = lazy(() => import("./pages/StaffInvitationDecision"));
const NotFound = lazy(() => import("./pages/NotFound"));

const SellerOverview = lazy(() => import("./pages/seller/SellerOverview"));
const SellerWarehouse = lazy(() => import("./pages/seller/SellerWarehouse"));
const SellerProducts = lazy(() => import("./pages/seller/SellerProducts"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerProfile = lazy(() => import("./pages/seller/SellerProfile"));
const SellerFinance = lazy(() => import("./pages/seller/SellerStubs").then((module) => ({ default: module.SellerFinance })));
const SellerPromo = lazy(() => import("./pages/seller/SellerStubs").then((module) => ({ default: module.SellerPromo })));
const SellerReviews = lazy(() => import("./pages/seller/SellerStubs").then((module) => ({ default: module.SellerReviews })));
const SellerSettings = lazy(() => import("./pages/seller/SellerStubs").then((module) => ({ default: module.SellerSettings })));

const TechnicianOrders = lazy(() => import("./pages/technician/TechnicianOrders"));
const TechnicianOrder = lazy(() => import("./pages/technician/TechnicianOrder"));
const TechnicianProduction = lazy(() => import("./pages/technician/TechnicianProduction"));
const TechnicianArchive = lazy(() => import("./pages/technician/TechnicianArchive"));
const TechnicianMessages = lazy(() => import("./pages/technician/TechnicianMessages"));
const TechnicianMaterials = lazy(() => import("./pages/technician/TechnicianMaterials"));
const TechnicianFinance = lazy(() => import("./pages/technician/TechnicianFinance"));
const TechnicianSettlements = lazy(() => import("./pages/technician/TechnicianSettlements"));
const TechnicianProfile = lazy(() => import("./pages/technician/TechnicianProfile"));

const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminDoctors = lazy(() => import("./pages/admin/Doctors"));
const AdminClinics = lazy(() => import("./pages/admin/Clinics"));
const AdminPatients = lazy(() => import("./pages/admin/Patients"));
const AdminAppointments = lazy(() => import("./pages/admin/Appointments"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const Ads = lazy(() => import("./pages/admin/Ads"));
const Moderation = lazy(() => import("./pages/admin/Moderation"));
const AdminReviews = lazy(() => import("./pages/admin/Reviews"));
const Promo = lazy(() => import("./pages/admin/Promo"));
const Blog = lazy(() => import("./pages/admin/Blog"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminIntegrations = lazy(() => import("./pages/admin/Integrations"));
const AdminVerification = lazy(() => import("./pages/admin/Verification"));
const AdminBadges = lazy(() => import("./pages/admin/Badges"));
const AdminPromotions = lazy(() => import("./pages/admin/Promotions"));
const AdminLab = lazy(() => import("./pages/admin/Lab"));
const AdminReferrals = lazy(() => import("./pages/admin/Referrals"));
const AdminMarketOrders = lazy(() => import("./pages/admin/MarketOrders"));
const AdminMarketSellers = lazy(() => import("./pages/admin/MarketSellers"));
const AdminMarketProducts = lazy(() => import("./pages/admin/MarketProducts"));
const AdminMarketReviews = lazy(() => import("./pages/admin/MarketReviews"));
const AdminMarketDisputes = lazy(() => import("./pages/admin/MarketDisputes"));
const AdminJobReports = lazy(() => import("./pages/admin/JobReports"));
const AdminBroadcast = lazy(() => import("./pages/admin/Broadcast"));

const DoctorPublicProfile = lazy(() => import("./pages/doctor/DoctorPublicProfile"));

const MarketCatalog = lazy(() => import("./pages/market/MarketCatalog"));
const MarketCart = lazy(() => import("./pages/market/MarketCart"));
const MarketOrders = lazy(() => import("./pages/market/MarketOrders"));
const MarketProductDetail = lazy(() => import("./pages/market/MarketProductDetail"));
const MarketSupplierProfile = lazy(() => import("./pages/market/MarketSupplierProfile"));
const JobsFeed = lazy(() => import("./pages/jobs/JobsFeed"));
const JobListingDetail = lazy(() => import("./pages/jobs/JobListingDetail"));
const ResumesFeed = lazy(() => import("./pages/jobs/ResumesFeed"));
const ResumeDetail = lazy(() => import("./pages/jobs/ResumeDetail"));
const JobsMy = lazy(() => import("./pages/jobs/JobsMy"));
const JobPostForm = lazy(() => import("./pages/jobs/JobPostForm"));
const JobsModeration = lazy(() => import("./pages/jobs/JobsModeration"));
const SkladItems = lazy(() => import("./pages/sklad/SkladItems"));
const SkladTransactions = lazy(() => import("./pages/sklad/SkladTransactions"));
const SkladCategories = lazy(() => import("./pages/sklad/SkladCategories"));
const SkladSuppliers = lazy(() => import("./pages/sklad/SkladSuppliers"));
const LabOrders = lazy(() => import("./pages/lab/LabOrders"));
const LabLabs = lazy(() => import("./pages/lab/LabLabs"));
const LabFinance = lazy(() => import("./pages/lab/LabFinance"));

const PatientDashboardPage = lazy(() => import("./pages/patient/PatientDashboardPage"));
const PatientBook = lazy(() => import("./pages/patient/PatientBook"));
const PatientAppointments = lazy(() => import("./pages/patient/PatientAppointments"));
const PatientHistory = lazy(() => import("./pages/patient/PatientHistory"));
const PatientReminders = lazy(() => import("./pages/patient/PatientReminders"));
const PatientNotifications = lazy(() => import("./pages/patient/PatientNotifications"));
const PatientDoctorsPage = lazy(() => import("./pages/patient/PatientDoctorsPage"));
const PatientPaymentsPage = lazy(() => import("./pages/patient/PatientPaymentsPage"));
const PatientMedical = lazy(() => import("./pages/patient/PatientMedical"));
const PatientMessages = lazy(() => import("./pages/patient/PatientMessages"));
const PatientFiles = lazy(() => import("./pages/patient/PatientFiles"));
const PatientFamily = lazy(() => import("./pages/patient/PatientFamily"));
const PatientAccessHistory = lazy(() => import("./pages/patient/PatientAccessHistory"));

// Fires a GA4/Metrika page_view on every client-side route change. Without this
// only the initial document load was tracked (SPA navigations were invisible).
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    analytics.pageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function LegacyBookingRedirect() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const { search } = useLocation();
  return <Navigate replace to={`/book/${doctorId ?? ""}${search}`} />;
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

function I18nNamespaceGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { ensureAppTranslations, language } = useLanguage();
  const routeNamespaces = useMemo(
    () => getAppTranslationNamespaces(location.pathname),
    [location.pathname],
  );
  const routeNeedsAppTranslations = routeNamespaces.length > 0;
  const readyKey = useMemo(
    () =>
      `${language}:${
        routeNeedsAppTranslations ? routeNamespaces.join("+") : "base"
      }`,
    [language, routeNeedsAppTranslations, routeNamespaces],
  );
  const [loadedKey, setLoadedKey] = useState(routeNeedsAppTranslations ? "" : readyKey);
  const [loadedPathname, setLoadedPathname] = useState(
    routeNeedsAppTranslations ? "" : location.pathname,
  );

  useEffect(() => {
    let active = true;

    if (!routeNeedsAppTranslations) {
      setLoadedKey(readyKey);
      setLoadedPathname(location.pathname);
      return () => {
        active = false;
      };
    }

    setLoadedKey("");
    void ensureAppTranslations(routeNamespaces)
      .catch((error) => {
        console.error("Could not load app locale namespace", error);
      })
      .finally(() => {
        if (active) {
          setLoadedKey(readyKey);
          setLoadedPathname(location.pathname);
        }
      });

    return () => {
      active = false;
    };
  }, [
    ensureAppTranslations,
    location.pathname,
    readyKey,
    routeNeedsAppTranslations,
    routeNamespaces,
  ]);

  // A language switch on the same route must not remount forms and erase
  // unsaved input while the new route namespace is loading.
  if (loadedKey !== readyKey && loadedPathname !== location.pathname) {
    return <RouteLoadingFallback />;
  }

  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sensible defaults (was unconfigured → aggressive refetch/retry storms).
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* Dark mode is enabled globally. Legacy pages with fixed light colors are
        migrated page by page; Sprint 2 reference routes and shared components
        are required to support both themes. */}
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <a
            href="#main-content"
            className="fixed left-3 top-3 z-[1000] -translate-y-[200%] rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-teal-200"
          >
            Перейти к содержимому
          </a>
          <RouteTracker />
          <RouteAccessibility />
          <AuthProvider>
          <ClinicProvider>
            <AdminProvider>
              <ErrorBoundary>
              <div id="main-content" tabIndex={-1}>
              <I18nNamespaceGate>
              <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/search" element={<Search />} />
            <Route path="/clinics" element={<Clinics />} />
            <Route path="/clinic/:id" element={<ClinicProfile />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/articles/:slug" element={<ArticleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/doctor/:id" element={<DoctorPublicProfile />} />
            <Route path="/book/:doctorId" element={<PublicBooking />} />
            <Route path="/booking/:doctorId" element={<LegacyBookingRedirect />} />
            <Route path="/treatment-plan" element={<TreatmentPlanPublic />} />
            <Route path="/staff-invitations/:token" element={<StaffInvitationDecision />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/seller" element={<SellerOverview />} />
            <Route path="/seller/products" element={<SellerProducts />} />
            <Route path="/seller/warehouse" element={<SellerWarehouse />} />
            <Route path="/seller/orders" element={<SellerOrders />} />
            <Route path="/seller/finance" element={<SellerFinance />} />
            <Route path="/seller/promo" element={<SellerPromo />} />
            <Route path="/seller/reviews" element={<SellerReviews />} />
            <Route path="/seller/profile" element={<SellerProfile />} />
            <Route path="/seller/settings" element={<SellerSettings />} />
            <Route path="/technician" element={<TechnicianOrders />} />
            <Route path="/technician/production" element={<TechnicianProduction />} />
            <Route path="/technician/order" element={<TechnicianOrder />} />
            <Route path="/technician/archive" element={<TechnicianArchive />} />
            <Route path="/technician/messages" element={<TechnicianMessages />} />
            <Route path="/technician/materials" element={<TechnicianMaterials />} />
            <Route path="/technician/finance" element={<TechnicianFinance />} />
            <Route path="/technician/settlements" element={<TechnicianSettlements />} />
            <Route path="/technician/profile" element={<TechnicianProfile />} />
            <Route element={<AdminRouteBoundary />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/doctors" element={<AdminDoctors />} />
              <Route path="/admin/clinics" element={<AdminClinics />} />
              <Route path="/admin/patients" element={<AdminPatients />} />
              <Route path="/admin/appointments" element={<AdminAppointments />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/integrations" element={<AdminIntegrations />} />
              <Route path="/admin/ads" element={<Ads />} />
              <Route path="/admin/moderation" element={<Moderation />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/promo" element={<Promo />} />
              <Route path="/admin/blog" element={<Blog />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/verification" element={<AdminVerification />} />
              <Route path="/admin/badges" element={<AdminBadges />} />
              <Route path="/admin/promotions" element={<AdminPromotions />} />
              <Route path="/admin/lab" element={<AdminLab />} />
              <Route path="/admin/referrals" element={<AdminReferrals />} />
              <Route path="/admin/market/orders" element={<AdminMarketOrders />} />
              <Route path="/admin/market/sellers" element={<AdminMarketSellers />} />
              <Route path="/admin/market/products" element={<AdminMarketProducts />} />
              <Route path="/admin/market/reviews" element={<AdminMarketReviews />} />
              <Route path="/admin/market/disputes" element={<AdminMarketDisputes />} />
              <Route path="/admin/job-reports" element={<AdminJobReports />} />
              <Route path="/admin/broadcast" element={<AdminBroadcast />} />
            </Route>
            {/* Staff pages keep their existing layouts as a second guard. */}
            {crmRouteElements}
            {/* Склад moved to its own standalone shell (/sklad). */}
            {/* Лаборатория moved to its own standalone shell (/lab). */}
            {clinicAdminRouteElements}
            {doctorRouteElements}
            {/* Лаборатория moved to its own standalone shell (/lab). */}

            {/* Standalone marketplace — own shell (MarketLayout) outside the cabinet,
                cart shared via MarketCartProvider. Future: market.prodent.uz. */}
            <Route
              element={
                <MarketCartProvider>
                  <MarketLayout />
                </MarketCartProvider>
              }
            >
              <Route path={MARKET_ROUTES.catalog()} element={<MarketCatalog />} />
              <Route path={MARKET_ROUTES.product(":id")} element={<MarketProductDetail />} />
              <Route path={MARKET_ROUTES.supplier(":id")} element={<MarketSupplierProfile />} />
              <Route path={MARKET_ROUTES.cart()} element={<MarketCart />} />
              <Route path={MARKET_ROUTES.orders()} element={<MarketOrders />} />
            </Route>

            {/* Standalone Jobs module — own shell (JobsLayout) outside the cabinet,
                doctors-and-clinics only. Future: work.prodent.uz. */}
            <Route element={<JobsLayout />}>
              <Route path={JOBS_ROUTES.feed()} element={<JobsFeed />} />
              <Route path={JOBS_ROUTES.listing(":id")} element={<JobListingDetail />} />
              <Route path={JOBS_ROUTES.resumes()} element={<ResumesFeed />} />
              <Route path={JOBS_ROUTES.resume(":id")} element={<ResumeDetail />} />
              <Route path={JOBS_ROUTES.my()} element={<JobsMy />} />
              <Route path={JOBS_ROUTES.post()} element={<JobPostForm />} />
              <Route path={JOBS_ROUTES.edit(":id")} element={<JobPostForm />} />
              <Route path={JOBS_ROUTES.moderation()} element={<JobsModeration />} />
            </Route>

            {/* Standalone Склад module — own shell (SkladLayout) outside the cabinet.
                Clinic staff see the clinic warehouse; a doctor sees their personal
                one (server decides scope by role). Future: sklad.prodent.uz. */}
            <Route element={<SkladLayout />}>
              <Route path={SKLAD_ROUTES.items()} element={<SkladItems />} />
              <Route path={SKLAD_ROUTES.transactions()} element={<SkladTransactions />} />
              <Route path={SKLAD_ROUTES.categories()} element={<SkladCategories />} />
              <Route path={SKLAD_ROUTES.suppliers()} element={<SkladSuppliers />} />
            </Route>

            {/* Standalone Лаборатория module — own shell (LabLayout) outside the
                cabinet. Clinic staff / doctors order lab work; the server scopes
                by role. Menu: Заказы + Лаборатории. Future: lab.prodent.uz. */}
            <Route element={<LabLayout />}>
              <Route path={LAB_ROUTES.orders()} element={<LabOrders />} />
              <Route path={LAB_ROUTES.labs()} element={<LabLabs />} />
              <Route path={LAB_ROUTES.finance()} element={<LabFinance />} />
            </Route>

            {/* Assistant Routes */}
            {assistantRouteElements}

            {/* Accountant Routes */}
            {accountantRouteElements}

            {/* Manager Routes */}
            {managerRouteElements}

            {/* Patient Routes */}
            <Route path="/patient" element={<PatientDashboardPage />} />
            <Route path="/patient/dashboard" element={<PatientDashboardPage />} />
            <Route path="/patient/appointments" element={<PatientAppointments />} />
            <Route path="/patient/book" element={<PatientBook />} />
            <Route path="/patient/history" element={<PatientHistory />} />
            <Route path="/patient/reminders" element={<PatientReminders />} />
            <Route path="/patient/notifications" element={<PatientNotifications />} />
            <Route path="/patient/my-doctors" element={<PatientDoctorsPage />} />
            <Route path="/patient/billing" element={<PatientPaymentsPage />} />
            <Route path="/patient/medical" element={<PatientMedical />} />
            <Route path="/patient/access" element={<PatientAccessHistory />} />
            <Route path="/patient/messages" element={<PatientMessages />} />
            <Route path="/patient/files" element={<PatientFiles />} />
            <Route path="/patient/family" element={<PatientFamily />} />

            {/* Legal & Info */}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contacts" element={<Contacts />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
              </Suspense>
              </I18nNamespaceGate>
              </div>
              </ErrorBoundary>
              </AdminProvider>
            </ClinicProvider>
          </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
