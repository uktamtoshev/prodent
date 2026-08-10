import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Boxes,
  Loader2,
  LogIn,
  Package,
  Tags,
  Truck,
  User,
  Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { CABINET_HOME, SKLAD_ROUTES } from "@/lib/sklad-routes";
import { sklad, type WarehouseMode } from "@/lib/sklad";
import { cn } from "@/lib/utils";

// Clinic staff (director/owner, admin, reception/manager, accountant) + a plain
// doctor. Mirrors SkladController.MODULE_ROLES — the server is the real
// authority; this just keeps everyone else out of the UI. Which warehouse space
// the caller lands in (clinic vs personal) is decided by the server.
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
  "assistant",
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
  icon: typeof Package;
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

// Standalone Склад shell — its own top menu, rendered OUTSIDE CRMLayout. Mounted
// as a react-router layout route, children render through <Outlet/>. Built to
// move to sklad.prodent.uz (see ops/sklad-module-spec.md §7).
export function SkladLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [mode, setMode] = useState<WarehouseMode | null>(null);

  const stillLoading = authLoading || roleLoading;
  const isAuthorized = !!user && !!role && ALLOWED_ROLES.has(role);

  useEffect(() => {
    if (stillLoading) return;
    if (!user) navigate("/auth");
    else if (!isAuthorized) navigate("/");
  }, [stillLoading, user, isAuthorized, navigate]);

  // Ask the server which warehouse space we're in (drives the header badge).
  useEffect(() => {
    if (!isAuthorized) return;
    sklad
      .me()
      .then((r) => setMode(r.mode))
      .catch(() => setMode(null));
  }, [isAuthorized]);

  if (stillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }
  if (!isAuthorized) return null;

  const path = location.pathname;
  const onItems = path === SKLAD_ROUTES.items();
  const onTransactions = path.startsWith(SKLAD_ROUTES.transactions());
  const onCategories = path.startsWith(SKLAD_ROUTES.categories());
  const onSuppliers = path.startsWith(SKLAD_ROUTES.suppliers());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0 lg:px-6">
          <Link
            to={SKLAD_ROUTES.items()}
            aria-label="PRODENT Склад"
            className="mr-2 inline-flex min-h-11 items-center gap-2 rounded-prodent-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="grid h-9 w-9 place-items-center rounded-prodent-input bg-brand text-sidebar-text shadow-design-btn">
              <Boxes className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-base font-bold leading-none">
              PRODENT <span className="text-brand">Склад</span>
            </span>
          </Link>

          {mode && (
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
                "border border-border bg-muted text-muted-foreground",
              )}
            >
              {mode === "clinic" ? <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> : <User className="h-3.5 w-3.5" aria-hidden="true" />}
              {mode === "clinic" ? "Склад клиники" : "Личный склад"}
            </span>
          )}

          <nav aria-label="Разделы склада" className="order-last flex w-full max-w-full items-center justify-around gap-1 overflow-x-auto lg:order-none lg:ml-1 lg:w-auto lg:justify-start">
            <NavItem to={SKLAD_ROUTES.items()} active={onItems} icon={Package} label="Позиции" />
            <NavItem to={SKLAD_ROUTES.transactions()} active={onTransactions} icon={ArrowLeftRight} label="Движения" />
            <NavItem to={SKLAD_ROUTES.categories()} active={onCategories} icon={Tags} label="Категории" />
            <NavItem to={SKLAD_ROUTES.suppliers()} active={onSuppliers} icon={Truck} label="Поставщики" />
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
