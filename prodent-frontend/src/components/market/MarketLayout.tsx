import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Loader2, LogIn, Package, ShoppingCart, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useMarketCart } from "@/contexts/MarketCartContext";
import { CABINET_HOME, MARKET_ROUTES } from "@/lib/market-routes";
import { cn } from "@/lib/utils";

// Cabinet roles allowed to shop in the marketplace — mirrors CRMLayout's set.
// The server (MarketplaceController) is the real authority on what each role can
// do; this just keeps anonymous/patient users out of the buyer UI.
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
  "assistant",
  "accountant",
]);

function NavItem({ to, active, icon: Icon, label }: { to: string; active: boolean; icon: typeof Store; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-cell font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

// Standalone marketplace shell: its own top menu (Каталог · Мои заказы · Корзина ·
// «Кабинет врача»), rendered OUTSIDE the cabinet's CRMLayout. Mounted as a
// react-router layout route, so child pages render through <Outlet/>.
export function MarketLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { count } = useMarketCart();

  const stillLoading = authLoading || roleLoading;
  const isAuthorized = !!user && !!role && ALLOWED_ROLES.has(role);

  // Mirror CRMLayout's guard: bounce anonymous users to /auth and disallowed
  // roles back to the landing page.
  useEffect(() => {
    if (stillLoading) return;
    if (!user) {
      navigate("/auth");
    } else if (!isAuthorized) {
      navigate("/");
    }
  }, [stillLoading, user, isAuthorized, navigate]);

  if (stillLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Загружаем магазин…</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // effect above navigates away
  }

  const path = location.pathname;
  const onCatalog = path === MARKET_ROUTES.catalog();
  const onOrders = path.startsWith(MARKET_ROUTES.orders());
  const onCart = path.startsWith(MARKET_ROUTES.cart());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 lg:h-14 lg:flex-nowrap lg:py-0 lg:px-6">
          {/* Logo → catalog home */}
          <Link
            to={MARKET_ROUTES.catalog()}
            aria-label="PRODENT Маркет — каталог"
            className="mr-2 inline-flex min-h-11 items-center gap-2 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground">
              <Store className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-bold font-display leading-none">
              PRODENT <span className="text-primary">Маркет</span>
            </span>
          </Link>

          {/* Primary nav */}
          <nav aria-label="Разделы магазина" className="order-last flex w-full max-w-full items-center justify-around gap-1 overflow-x-auto lg:order-none lg:ml-1 lg:w-auto lg:justify-start">
            <NavItem to={MARKET_ROUTES.catalog()} active={onCatalog} icon={LayoutGrid} label="Каталог" />
            <NavItem to={MARKET_ROUTES.orders()} active={onOrders} icon={Package} label="Мои заказы" />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Cart with live badge */}
            <Link
              to={MARKET_ROUTES.cart()}
              aria-label={`Корзина, товаров: ${count}`}
              className={cn(
                "relative inline-flex h-11 items-center gap-2 rounded-[10px] border px-3 text-cell font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                onCart
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">Корзина</span>
              {count > 0 && (
                <span aria-hidden="true" className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground tabular-nums">
                  {count}
                </span>
              )}
            </Link>

            {/* Back to the cabinet */}
            <Link
              to={CABINET_HOME}
              aria-label="Вернуться в кабинет врача"
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-foreground px-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <LogIn className="h-4 w-4 rotate-180" aria-hidden="true" />
              <span className="hidden lg:inline">Кабинет врача</span>
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
