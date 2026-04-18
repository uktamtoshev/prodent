import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ClinicProvider } from "@/contexts/ClinicContext";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Landing from "./pages/Landing";
import Clinics from "./pages/Clinics";
import ClinicProfile from "./pages/ClinicProfile";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import DoctorPublicProfile from "./pages/doctor/DoctorPublicProfile";
import Appointments from "./pages/Appointments";
import Promotions from "./pages/Promotions";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/admin/Dashboard";
import AdminDoctors from "./pages/admin/Doctors";
import AdminClinics from "./pages/admin/Clinics";
import AdminPatients from "./pages/admin/Patients";
import AdminAppointments from "./pages/admin/Appointments";
import AdminPayments from "./pages/admin/Payments";
import Ads from "./pages/admin/Ads";
import Moderation from "./pages/admin/Moderation";
import AdminReviews from "./pages/admin/Reviews";
import Promo from "./pages/admin/Promo";
import Blog from "./pages/admin/Blog";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminVerification from "./pages/admin/Verification";
import AdminBadges from "./pages/admin/Badges";
import AdminPromotions from "./pages/admin/Promotions";
import CRMDashboard from "./pages/crm/Dashboard";
import Schedule from "./pages/crm/Schedule";
import CRMAppointments from "./pages/crm/Appointments";
import Patients from "./pages/crm/Patients";
import PatientDetail from "./pages/crm/PatientDetail";
import MedicalRecords from "./pages/crm/MedicalRecords";
import Queue from "./pages/crm/Queue";
import Finance from "./pages/crm/Finance";
import CRMProfile from "./pages/crm/CRMProfile";
import CRMNotifications from "./pages/crm/Notifications";
import CRMSettings from "./pages/crm/CRMSettings";
import CRMInventory from "./pages/crm/Inventory";
import CRMLaboratory from "./pages/crm/Laboratory";
import CRMReports from "./pages/crm/Reports";
import DoctorRequests from "./pages/crm/DoctorRequests";
import CRMMessages from "./pages/crm/Messages";
import CRMServices from "./pages/crm/Services";
import CRMTasks from "./pages/crm/Tasks";
import ClinicBalance from "./pages/crm/ClinicBalance";
import CRMBilling from "./pages/crm/Billing";
import PublicBooking from "./pages/PublicBooking";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contacts from "./pages/Contacts";

// Clinic Admin Pages
import ClinicAdminSchedule from "./pages/clinic-admin/ClinicAdminSchedule";
import ClinicAdminAppointments from "./pages/clinic-admin/ClinicAdminAppointments";
import ClinicAdminPatients from "./pages/clinic-admin/ClinicAdminPatients";
import ClinicAdminPayments from "./pages/clinic-admin/ClinicAdminPayments";
import ClinicAdminPromotions from "./pages/clinic-admin/ClinicAdminPromotions";
import ClinicAdminNotifications from "./pages/clinic-admin/ClinicAdminNotifications";
import ClinicAdminSettings from "./pages/clinic-admin/ClinicAdminSettings";
import ClinicAdminMessages from "./pages/clinic-admin/ClinicAdminMessages";

// Doctor Pages
import DoctorCalendar from "./pages/doctor/DoctorCalendar";
import DoctorPatients from "./pages/doctor/DoctorPatients";
import DoctorPatientProfile from "./pages/doctor/DoctorPatientProfile";
import DoctorMedicalRecords from "./pages/doctor/DoctorMedicalRecords";
import DoctorTreatmentPlans from "./pages/doctor/DoctorTreatmentPlans";
import DoctorMedia from "./pages/doctor/DoctorMedia";
import DoctorLaboratory from "./pages/doctor/DoctorLaboratory";
import DoctorMessages from "./pages/doctor/DoctorMessages";
import DoctorBalance from "./pages/doctor/DoctorBalance";
import DoctorBilling from "./pages/doctor/DoctorBilling";

// Assistant Pages
import AssistantSchedule from "./pages/assistant/AssistantSchedule";
import AssistantRooms from "./pages/assistant/AssistantRooms";
import AssistantMaterials from "./pages/assistant/AssistantMaterials";
import AssistantAppointments from "./pages/assistant/AssistantAppointments";

// Accountant Pages
import AccountantInvoices from "./pages/accountant/AccountantInvoices";
import AccountantPayments from "./pages/accountant/AccountantPayments";
import AccountantReports from "./pages/accountant/AccountantReports";
import AccountantSalaries from "./pages/accountant/AccountantSalaries";

// Manager Pages
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerKPI from "./pages/manager/ManagerKPI";
import ManagerAnalytics from "./pages/manager/ManagerAnalytics";
import ManagerStaff from "./pages/manager/ManagerStaff";
import ManagerServices from "./pages/manager/ManagerServices";

// Patient Pages
import PatientDashboardPage from "./pages/patient/PatientDashboardPage";
import PatientBook from "./pages/patient/PatientBook";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientHistory from "./pages/patient/PatientHistory";
import PatientReminders from "./pages/patient/PatientReminders";
import PatientNotifications from "./pages/patient/PatientNotifications";
import PatientDoctorsPage from "./pages/patient/PatientDoctorsPage";
import PatientPaymentsPage from "./pages/patient/PatientPaymentsPage";
import PatientMedical from "./pages/patient/PatientMedical";
import PatientMessages from "./pages/patient/PatientMessages";
import PatientFiles from "./pages/patient/PatientFiles";
import PatientFamily from "./pages/patient/PatientFamily";
import PatientAccessHistory from "./pages/patient/PatientAccessHistory";
import DoctorNotifications from "./pages/doctor/DoctorNotifications";
import TreatmentPlanPublic from "./pages/TreatmentPlanPublic";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthProvider>
          <ClinicProvider>
            <AdminProvider>
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
            <Route path="/profile" element={<Profile />} />
            <Route path="/doctor/:id" element={<DoctorPublicProfile />} />
            <Route path="/book/:doctorId" element={<PublicBooking />} />
            <Route path="/treatment-plan/:token" element={<TreatmentPlanPublic />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/doctors" element={<AdminDoctors />} />
            <Route path="/admin/clinics" element={<AdminClinics />} />
            <Route path="/admin/patients" element={<AdminPatients />} />
            <Route path="/admin/appointments" element={<AdminAppointments />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
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
            <Route path="/crm" element={<CRMDashboard />} />
            <Route path="/crm/schedule" element={<Schedule />} />
            <Route path="/crm/appointments" element={<CRMAppointments />} />
            <Route path="/crm/patients" element={<Patients />} />
            <Route path="/crm/patients/:id" element={<PatientDetail />} />
            <Route path="/crm/medical-records" element={<MedicalRecords />} />
            <Route path="/crm/medical/:patientId" element={<MedicalRecords />} />
            <Route path="/crm/messages" element={<CRMMessages />} />
            <Route path="/crm/queue" element={<Queue />} />
            <Route path="/crm/inventory" element={<CRMInventory />} />
            <Route path="/crm/finance" element={<Finance />} />
            <Route path="/crm/laboratory" element={<CRMLaboratory />} />
            <Route path="/crm/reports" element={<CRMReports />} />
            <Route path="/crm/profile" element={<CRMProfile />} />
            <Route path="/crm/notifications" element={<CRMNotifications />} />
            <Route path="/crm/settings" element={<CRMSettings />} />
            <Route path="/crm/services" element={<CRMServices />} />
            <Route path="/crm/doctor-requests" element={<DoctorRequests />} />
            <Route path="/crm/balance" element={<ClinicBalance />} />
            <Route path="/crm/billing" element={<CRMBilling />} />
            <Route path="/crm/tasks" element={<CRMTasks />} />

            {/* Clinic Admin Routes */}
            <Route path="/clinic-admin/schedule" element={<ClinicAdminSchedule />} />
            <Route path="/clinic-admin/appointments" element={<ClinicAdminAppointments />} />
            <Route path="/clinic-admin/patients" element={<ClinicAdminPatients />} />
            <Route path="/clinic-admin/messages" element={<ClinicAdminMessages />} />
            <Route path="/clinic-admin/payments" element={<ClinicAdminPayments />} />
            <Route path="/clinic-admin/promotions" element={<ClinicAdminPromotions />} />
            <Route path="/clinic-admin/notifications" element={<ClinicAdminNotifications />} />
            <Route path="/clinic-admin/settings" element={<ClinicAdminSettings />} />

            {/* Doctor Routes */}
            <Route path="/doctor" element={<Navigate to="/doctor/calendar" replace />} />
            <Route path="/doctor/calendar" element={<DoctorCalendar />} />
            <Route path="/doctor/patients" element={<DoctorPatients />} />
            <Route path="/doctor/patients/:patientId" element={<DoctorPatientProfile />} />
            <Route path="/doctor/messages" element={<DoctorMessages />} />
            <Route path="/doctor/notifications" element={<DoctorNotifications />} />
            <Route path="/doctor/medical-records" element={<DoctorMedicalRecords />} />
            <Route path="/doctor/treatment-plans" element={<DoctorTreatmentPlans />} />
            <Route path="/doctor/media" element={<DoctorMedia />} />
            <Route path="/doctor/laboratory" element={<DoctorLaboratory />} />
            <Route path="/doctor/balance" element={<DoctorBalance />} />
            <Route path="/doctor/billing" element={<DoctorBilling />} />

            {/* Assistant Routes */}
            <Route path="/assistant/schedule" element={<AssistantSchedule />} />
            <Route path="/assistant/rooms" element={<AssistantRooms />} />
            <Route path="/assistant/materials" element={<AssistantMaterials />} />
            <Route path="/assistant/appointments" element={<AssistantAppointments />} />

            {/* Accountant Routes */}
            <Route path="/accountant/invoices" element={<AccountantInvoices />} />
            <Route path="/accountant/payments" element={<AccountantPayments />} />
            <Route path="/accountant/reports" element={<AccountantReports />} />
            <Route path="/accountant/salaries" element={<AccountantSalaries />} />

            {/* Manager Routes */}
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/kpi" element={<ManagerKPI />} />
            <Route path="/manager/analytics" element={<ManagerAnalytics />} />
            <Route path="/manager/staff" element={<ManagerStaff />} />
            <Route path="/manager/services" element={<ManagerServices />} />

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
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contacts" element={<Contacts />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
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
