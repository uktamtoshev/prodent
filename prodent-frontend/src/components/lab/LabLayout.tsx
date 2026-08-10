import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  FlaskConical,
  Loader2,
  LogIn,
  User,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { CABINET_HOME, LAB_ROUTES } from "@/lib/lab-routes";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

// Clinic staff (director/owner, admin, reception/manager) + a plain doctor may
// order lab work. Mirrors the roles that previously had the "laboratory" module
// in the cabinet — the server (LabController) is the real authority; this only
// keeps everyone else out of the UI. Which scope the caller lands in (clinic vs
// personal doctor) is decided server-side by role.
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
  "accountant",
]);

function NavItem({
  to,
  active,
  icon: Icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: typeof ClipboardList;
  label: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-prodent-input px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

// Standalone Лаборатория shell — its own top menu, rendered OUTSIDE the cabinet
// (CRMLayout/DoctorLayout). Mounted as a react-router layout route; children
// render through <Outlet/>. Built to move to lab.prodent.uz (see lab-routes.ts).
export function LabLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const stillLoading = authLoading || roleLoading;
  const isAuthorized = !!user && !!role && ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (stillLoading) return;
    if (!user) navigate("/auth");
    else if (!isAuthorized) navigate("/");
  }, [stillLoading, user, isAuthorized, navigate]);

  if (stillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }
  if (!isAuthorized) return null;

  const path = location.pathname;
  const onOrders = path === LAB_ROUTES.orders();
  const onLabs = path.startsWith(LAB_ROUTES.labs());
  const onFinance = path.startsWith(LAB_ROUTES.finance());

  // Display-only scope badge: a plain doctor orders on their own behalf; clinic
  // staff order for the clinic. The server enforces the real scope.
  const isDoctorScope = role === "doctor";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0 lg:px-6">
          <Link
            to={LAB_ROUTES.orders()}
            aria-label="PRODENT Лаборатория"
            className="mr-2 inline-flex min-h-11 items-center gap-2 rounded-prodent-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="grid h-9 w-9 place-items-center rounded-prodent-input bg-brand text-sidebar-text shadow-design-btn">
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-bold leading-none">
              PRODENT <span className="text-brand">Лаборатория</span>
            </span>
          </Link>

          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
              "border border-border bg-muted text-muted-foreground",
            )}
          >
            {isDoctorScope ? <User className="h-3.5 w-3.5" aria-hidden="true" /> : <Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {isDoctorScope ? "Врач" : "Клиника"}
          </span>

          <nav aria-label="Разделы лаборатории" className="order-last flex w-full max-w-full items-center justify-around gap-1 overflow-x-auto lg:order-none lg:ml-1 lg:w-auto lg:justify-start">
            <NavItem to={LAB_ROUTES.orders()} active={onOrders} icon={ClipboardList} label="Заказы" />
            <NavItem to={LAB_ROUTES.labs()} active={onLabs} icon={Building2} label="Лаборатории" />
            <NavItem to={LAB_ROUTES.finance()} active={onFinance} icon={Wallet} label="Расчёты" />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to={CABINET_HOME}
              aria-label="Вернуться в кабинет"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-prodent-btn bg-sidebar px-3.5 text-sm font-semibold text-sidebar-text transition hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LogIn className="h-4 w-4 rotate-180" aria-hidden="true" />
              <span className="hidden lg:inline">Кабинет</span>
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
