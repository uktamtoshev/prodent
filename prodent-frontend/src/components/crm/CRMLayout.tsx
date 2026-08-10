import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { CRMSidebarNew } from "./CRMSidebarNew";
import { RoleCabinetShell } from "@/components/shared/RoleCabinetShell";
import { CabinetShellProvider } from "@/components/shared/CabinetShellContext";
import { CabinetTopBar } from "@/components/shared/CabinetTopBar";
import { CabinetCommandPalette } from "@/components/shared/CabinetCommandPalette";
import { PermissionState } from "@/components/system/StatePanel";

interface CRMLayoutProps {
  children: ReactNode;
}

// Roles allowed inside the CRM area.
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
  "assistant",
  "accountant",
]);

export function CRMLayout({ children }: CRMLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  // useUserRole is cached via React Query (staleTime: Infinity), so this is
  // a O(1) cache hit on every navigation — no extra round trip per click.
  const { role, loading: roleLoading } = useUserRole();

  const stillLoading = authLoading || roleLoading;
  const isAuthorized = !!user && !!role && ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (stillLoading) return;
    if (!user) {
      toast({
        title: t("crm.accessDenied"),
        description: t("crm.loginRequired"),
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    if (!isAuthorized) {
      toast({
        title: t("crm.accessDenied"),
        description: t("crm.staffOnly"),
        variant: "destructive",
      });
      navigate("/");
    }
  }, [stillLoading, user, isAuthorized, navigate, toast, t]);

  if (stillLoading) {
    return (
      <RoleCabinetShell
        sidebar={<CRMSidebarNew />}
        isLoading
        loadingLabel={t("crm.loadingCabinet")}
      />
    );
  }

  if (!isAuthorized) {
    /**
     * The effect above navigates away, but that takes a tick — and a signed-in
     * user with the wrong role used to see a completely blank white screen in
     * the meantime, which reads as "the app is broken" rather than "this is not
     * for you". Say what happened instead of rendering nothing.
     */
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <PermissionState
          title={t("crm.accessDenied")}
          description={t("crm.staffOnly")}
        />
      </div>
    );
  }

  return (
    <CabinetShellProvider>
      <RoleCabinetShell
        sidebar={<CRMSidebarNew />}
        topBar={<CabinetTopBar />}
        mainClassName="transition-all duration-200"
      >
        {children}
      </RoleCabinetShell>
      {/* Mounted once per cabinet, outside <main>: the palette is a global
          keyboard surface, not page content. */}
      <CabinetCommandPalette />
    </CabinetShellProvider>
  );
}
