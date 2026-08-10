import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Briefcase, FileText, LayoutGrid, Loader2, LogIn, Plus, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { getHomeRoute } from "@/lib/roleHome";
import { cn } from "@/lib/utils";
import {
  isJobsAuthorized,
  JOBS_CLINIC_ROLES,
  JOBS_MODERATOR_ROLES,
} from "@/lib/jobs-access";

function NavItem({ to, active, icon: Icon, label }: { to: string; active: boolean; icon: typeof Briefcase; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-prodent-input px-3 text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

// Standalone Jobs shell — its own top menu, rendered OUTSIDE CRMLayout. Mounted
// as a react-router layout route, children render through <Outlet/>. Built to move
// to work.prodent.uz (see ops/jobs-module-spec.md §9).
export function JobsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const stillLoading = authLoading || roleLoading;
  const isAuthorized = isJobsAuthorized(!!user, role);
  const isClinic = !!role && JOBS_CLINIC_ROLES.has(role);
  const isMod = !!role && JOBS_MODERATOR_ROLES.has(role);
  const cabinetHome = getHomeRoute(role ? [role] : []);
  // Clinics AND doctors can publish (a doctor can post a vacancy or rent a chair).
  const canPost = isClinic || role === "doctor";

  useEffect(() => {
    if (stillLoading) return;
    if (!user) navigate("/auth");
    else if (!isAuthorized) navigate("/");
  }, [stillLoading, user, isAuthorized, navigate]);

  if (stillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }
  if (!isAuthorized) return null;

  const path = location.pathname;
  const onFeed = path === JOBS_ROUTES.feed();
  const onResumes = path.startsWith(JOBS_ROUTES.resumes());
  const onMy = path.startsWith(JOBS_ROUTES.my());
  const onModeration = path.startsWith(JOBS_ROUTES.moderation());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 sm:min-h-16 sm:flex-nowrap sm:py-0 lg:px-6">
          <Link to={JOBS_ROUTES.feed()} className="mr-2 inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-prodent-input bg-brand text-white shadow-design-btn">
              <Briefcase className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold leading-none">
              PRODENT <span className="hidden text-brand sm:inline">Работа</span>
            </span>
          </Link>

          <nav className="order-last mt-1 flex w-full items-center justify-around gap-1 sm:order-none sm:ml-1 sm:mt-0 sm:w-auto sm:justify-start">
            <NavItem to={JOBS_ROUTES.feed()} active={onFeed} icon={LayoutGrid} label="Вакансии" />
            {isClinic && <NavItem to={JOBS_ROUTES.resumes()} active={onResumes} icon={Users} label="Резюме" />}
            <NavItem to={JOBS_ROUTES.my()} active={onMy} icon={FileText} label="Мои" />
            {isMod && <NavItem to={JOBS_ROUTES.moderation()} active={onModeration} icon={ShieldCheck} label="Модерация" />}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {canPost && (
              <Link
                to={JOBS_ROUTES.post()}
                aria-label="Разместить объявление"
                className="inline-flex min-h-11 items-center gap-2 rounded-prodent-btn bg-brand px-3.5 text-sm font-semibold text-white shadow-design-btn transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Разместить</span>
              </Link>
            )}
            <Link
              to={cabinetHome}
              aria-label="Вернуться в кабинет"
              className="inline-flex min-h-11 items-center gap-2 rounded-prodent-btn bg-sidebar px-3.5 text-sm font-semibold text-sidebar-text transition hover:bg-sidebar-hover"
            >
              <LogIn className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">Кабинет</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}
