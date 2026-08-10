import { ReactNode, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PatientSidebar } from "./PatientSidebar";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PatientOfflineBanner } from "./PatientOfflineBanner";

interface PatientLayoutProps {
  children: ReactNode;
}

export function PatientLayout({ children }: PatientLayoutProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const checkAccess = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      navigate("/auth");
      return;
    }

    // Check if user is a doctor - redirect to their profile
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (doctor) {
      navigate(`/doctor/${doctor.id}`);
      return;
    }

    // Check user_roles for non-patient roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const norm = (record: { role?: string | null }) => (record.role || '').toLowerCase();
    const hasNonPatientRole = userRoles?.some(r => {
      const rn = norm(r);
      return rn === 'doctor' || rn === 'clinic_admin' || rn === 'super_admin' || rn === 'admin';
    });

    if (hasNonPatientRole) {
      // Redirect clinic admins to CRM
      if (userRoles?.some(r => norm(r) === 'clinic_admin')) {
        navigate("/crm");
        return;
      }
      // Redirect admins to admin panel
      if (userRoles?.some(r => norm(r) === 'super_admin' || norm(r) === 'admin')) {
        navigate("/admin");
        return;
      }
    }

    // Check clinic_members for non-patient roles
    const { data: membership } = await supabase
      .from("clinic_members")
      .select("role, clinic_id")
      .eq("user_id", userId);

    const hasStaffRole = membership?.some(m =>
      norm(m) !== 'patient'
    );

    if (hasStaffRole) {
      navigate("/crm");
      return;
    }

    // User is a patient - allow access
    setIsAuthorized(true);
  }, [navigate, user?.id]);

  useEffect(() => {
    if (!loading) {
      void checkAccess();
    }
  }, [checkAccess, loading]);

  if (loading || isAuthorized === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("patient.accessDenied")}</h1>
          <p className="text-muted-foreground">{t("patient.accessDeniedDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar handles its own mobile drawer + desktop fixed positioning */}
      <PatientSidebar />

      {/* Reserve the mobile toolbar and the 256px desktop sidebar. */}
      <main className="min-h-screen pt-16 lg:pl-64 lg:pt-0">
        <PatientOfflineBanner />
        {children}
      </main>
    </div>
  );
}
