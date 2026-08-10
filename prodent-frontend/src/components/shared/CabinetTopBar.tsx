import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Menu as MenuIcon, Search, X } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CABINET_SECTIONS,
  sectionForPath,
  type CabinetSectionKey,
} from "@/lib/cabinet-routes";
import { cn } from "@/lib/utils";
import { useCabinetShell } from "./CabinetShellContext";

/**
 * The cabinet's single top bar. 56px, sticky, one per screen.
 *
 * Replaces three stacked bars that between them cost 184px of vertical space on
 * a phone before any content appeared:
 *   - a 64px `fixed` strip that existed only as a backdrop for the hamburger,
 *   - a 48px sticky strip holding nothing but a notification bell,
 *   - the page's own 72px `DoctorTopbar` with a SECOND bell pointing at a
 *     different notifications page, and a second `h1`.
 *
 * What it owns: the mobile nav trigger, "where am I" (section name, or the
 * page's own published title), the page's action buttons, optional page search,
 * and the one notification bell.
 *
 * The section name comes from `lib/cabinet-routes.ts`, so it is correct on both
 * url namespaces without any page having to pass it.
 */

/** Sections that sit at the top level; anything else gets a parent crumb. */
const ROOT_SECTION: CabinetSectionKey = "home";

export function CabinetTopBar() {
  const { t } = useLanguage();
  const location = useLocation();
  const shell = useCabinetShell();

  const sectionKey = useMemo(
    () => sectionForPath(location.pathname),
    [location.pathname],
  );

  const sectionLabel = sectionKey
    ? t(CABINET_SECTIONS[sectionKey].labelKey)
    : undefined;

  // A page-published title wins over the route-derived one: a detail view knows
  // the patient's name, the catalog only knows "Patients".
  const title = shell?.chrome.title ?? sectionLabel;
  const subtitle = shell?.chrome.subtitle;
  const onSearch = shell?.chrome.onSearch;
  const searchPlaceholder =
    shell?.chrome.searchPlaceholder ?? t("doctorLayout.searchPlaceholder");

  const navOpen = shell?.navOpen ?? false;

  /**
   * The parent crumb earns its line only on a DETAIL view — one whose title is
   * something other than the section name (a patient's name, an invoice
   * number). When the page title already equals the section, a crumb saying the
   * same word twice would just push the page's own subtitle out of a 56px bar.
   */
  const showCrumb = Boolean(
    sectionKey &&
      sectionKey !== ROOT_SECTION &&
      shell?.chrome.title &&
      shell.chrome.title !== sectionLabel,
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-cabinet-topbar shrink-0 items-center gap-2",
        "border-b border-border bg-background/95 px-3 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/80 lg:px-6",
      )}
    >
      {/* Mobile nav trigger. Lives here rather than floating over the page, so
          no decorative backdrop strip is needed behind it. */}
      {shell && (
        <button
          type="button"
          onClick={() => shell.setNavOpen(!navOpen)}
          aria-label={t("roleSidebar.toggleNavigation")}
          aria-expanded={navOpen}
          aria-controls="role-sidebar-mobile-navigation"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-md",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden",
          )}
        >
          {navOpen ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <MenuIcon aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        {/* Breadcrumb: one level is all this cabinet is deep, and it doubles as
            the "back to the section list" affordance from a detail page. */}
        {showCrumb && sectionKey && (
          <nav aria-label={sectionLabel} className="min-w-0">
            <Link
              to={CABINET_SECTIONS[sectionKey].path}
              className="truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sectionLabel}
            </Link>
          </nav>
        )}
        {title && (
          <h1 className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        )}
        {subtitle && !showCrumb && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {onSearch && (
        /* Геометрия поиска из макета: 36px, тянется до 500px. Было фиксированное
           узкое поле в 256px, из-за чего строка поиска читалась как мелкий
           фильтр, а не как главный способ что-то найти.
           Класс cabinet-control возвращает 44px на касании — 36px пальцем
           не берётся. */
        <div className="relative hidden max-w-[500px] flex-1 md:block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearch(event.target.value)}
            className="cabinet-control h-ctl w-full rounded-field border border-border bg-background pl-9 pr-3 text-cell text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* Page action buttons portal in here. */}
      <div
        ref={shell?.setActionsSlot}
        className="flex shrink-0 items-center gap-2"
      />

      <NotificationBell
        seeAllPath={CABINET_SECTIONS.notifications.path}
        triggerClassName="h-11 w-11 shrink-0 rounded-prodent-input border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      />
    </header>
  );
}

/**
 * Render page action buttons into the cabinet top bar.
 *
 * Falls back to rendering in place when there is no shell, so the component is
 * safe to use from a page that may be mounted outside a migrated cabinet.
 */
export function CabinetTopBarActions({ children }: { children: ReactNode }) {
  const shell = useCabinetShell();
  if (!shell?.actionsSlot) return <>{children}</>;
  return createPortal(children, shell.actionsSlot);
}
