import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { TechnicianSidebar } from "./TechnicianSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TechnicianOfflineBanner } from "./TechnicianOfflineBanner";
import { Input } from "@/components/ui/input";

interface TechnicianLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  compact?: boolean;
}

export function TechnicianLayout({ children, title, subtitle, right, compact }: TechnicianLayoutProps) {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/");

  // Access control (was missing — any visitor could load the technician cabinet).
  // Owner cabinet: only technicians. SUPER_ADMIN uses /admin/lab instead.
  // Wait for AuthContext to finish loading before deciding — otherwise a full-page
  // load redirects to "/" while `user` is still null (it resolves a moment later).
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      if (!user) {
        if (active) setIsChecking(false);
        return;
      }
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const isTechnician = roles?.some((r: { role: string }) => r.role === "technician") ?? false;
        const isSuperAdmin = roles?.some((r: { role: string }) => r.role === "super_admin") ?? false;
        if (active) {
          setHasAccess(isTechnician);
          setRedirectTo(isSuperAdmin && !isTechnician ? "/admin/lab" : "/");
        }
      } catch {
        if (active) {
          setHasAccess(false);
          setRedirectTo("/");
        }
      } finally {
        if (active) setIsChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  if (authLoading || isChecking) {
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

  if (!user || !hasAccess) {
    return <Navigate to={user ? redirectTo : "/"} replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TechnicianSidebar />
      <div className="flex min-h-screen flex-col pt-16 lg:pl-64 lg:pt-0">
        <div className="sticky top-16 z-20 lg:top-0">
          <TechnicianOfflineBanner />
          {(title || right) && (
            <header
              className={cn(
                "flex items-center justify-between gap-3 border-b border-border bg-card/90 backdrop-blur",
                compact ? "h-14 px-4 sm:px-6" : "h-[72px] px-4 sm:px-6 lg:px-8"
              )}
            >
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative hidden md:block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder={t("technician.searchPlaceholder")}
                    aria-label={t("technician.searchPlaceholder")}
                    className="w-[280px] pl-9 pr-3"
                  />
                </div>
                <NotificationBell triggerClassName="h-11 w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                {right}
              </div>
            </header>
          )}
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
