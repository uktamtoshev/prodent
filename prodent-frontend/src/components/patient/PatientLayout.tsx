import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PatientSidebar } from "./PatientSidebar";
import { Loader2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface PatientLayoutProps {
  children: ReactNode;
}

export function PatientLayout({ children }: PatientLayoutProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      checkAccess();
    }
  }, [user, loading]);

  const checkAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user is a doctor - redirect to their profile
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (doctor) {
      navigate(`/doctor/${doctor.id}`);
      return;
    }

    // Check user_roles for non-patient roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasNonPatientRole = userRoles?.some(r => 
      r.role === 'doctor' || r.role === 'clinic_admin' || r.role === 'super_admin' || r.role === 'admin'
    );

    if (hasNonPatientRole) {
      // Redirect clinic admins to CRM
      if (userRoles?.some(r => r.role === 'clinic_admin')) {
        navigate("/crm");
        return;
      }
      // Redirect admins to admin panel
      if (userRoles?.some(r => r.role === 'super_admin' || r.role === 'admin')) {
        navigate("/admin");
        return;
      }
    }

    // Check clinic_members for non-patient roles  
    const { data: membership } = await supabase
      .from("clinic_members")
      .select("role, clinic_id")
      .eq("user_id", user.id);

    const hasStaffRole = membership?.some(m => 
      m.role !== 'patient'
    );

    if (hasStaffRole) {
      navigate("/crm");
      return;
    }

    // User is a patient - allow access
    setIsAuthorized(true);
  };

  if (loading || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Доступ запрещён</h1>
          <p className="text-muted-foreground">У вас нет прав для просмотра этой страницы</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-[15px]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-bold text-foreground hover:opacity-80 transition-opacity">PRODENT</Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <PatientSidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <main className="pt-16 lg:pt-0 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
