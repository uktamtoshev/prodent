import {
  ComponentType,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Globe,
  Image,
  LogOut,
  Menu as MenuIcon,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  useLanguage,
  Language,
  languageNames,
  languageFlags,
} from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { formatAccountId } from "@/lib/accountId";
import {
  WORKSPACE_BACKGROUNDS,
  readWorkspaceBackground,
  writeWorkspaceBackground,
  type WorkspaceBackground,
} from "@/lib/workspace-background";

/** Какие группы меню пользователь свернул. Пустой список = всё раскрыто. */
const COLLAPSED_GROUPS_KEY = "prodent_sidebar_collapsed_groups";
import { useCabinetShell } from "./CabinetShellContext";
import { BrandMark } from "@/components/shared/BrandMark";

const LANGUAGES: Language[] = ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"];
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type RoleSidebarNavItem = {
  title: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  end?: boolean;
  /**
   * Extra paths that also mean "you are in this section", for cabinets whose
   * pages live under more than one url namespace (the staff cabinet mounts the
   * same components under `/crm/*` and `/doctor/*`). Child routes match
   * automatically, so list entry points only. Defaults to `[path]`.
   *
   * See `lib/cabinet-routes.ts` for why aliases exist at all.
   */
  matchPaths?: readonly string[];
};

/**
 * Grouped nav — pass an array of these instead of a flat item list to render
 * a small uppercase section header above each block. `label: undefined` keeps
 * the items but hides the header (useful for the first "top" group).
 */
export type RoleSidebarNavGroup = {
  label?: string;
  items: RoleSidebarNavItem[];
};

function isGrouped(
  items: RoleSidebarNavItem[] | RoleSidebarNavGroup[],
): items is RoleSidebarNavGroup[] {
  return items.length > 0 && "items" in (items[0] as object);
}

interface RoleSidebarProps {
  /** Short role badge label shown next to the logo (e.g. "ADMIN", "ВРАЧ"). */
  roleLabel: string;
  /** Nav items — flat list, or grouped by section. */
  items: RoleSidebarNavItem[] | RoleSidebarNavGroup[];
  /** Optional content rendered between the nav list and the footer (stats, clinic switcher, etc.). */
  extra?: ReactNode;
  /**
   * Optional custom logout handler. Defaults to AuthContext.signOut(). Use this when
   * the cabinet needs to navigate somewhere specific after sign-out (e.g. show a toast).
   */
  onLogout?: () => void | Promise<void>;
}

/**
 * Single shared cabinet sidebar — dark navy bg, white text, w-64.
 *
 * All role cabinets (admin / clinic-admin / doctor-CRM / patient / manager /
 * accountant / assistant / seller / technician) should consume this so the
 * "form" is identical across the product. Visual tokens come from the
 * --sidebar-* CSS variables (defined in index.css) and the Tailwind
 * sidebar.* color group — change those, every cabinet updates.
 *
 * Built-in: branding header, role badge, nav list with badges and active
 * highlight, fixed desktop positioning + mobile drawer, footer with avatar,
 * theme toggle and logout.
 */
export function RoleSidebar({
  roleLabel,
  items,
  extra,
  onLogout,
}: RoleSidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { displayName, accountNumber, profile } = useProfile();
  // `profiles.account_number` is the eight-digit id the user reads out to
  // support. Fall back to the uuid for rows that somehow lack one, so the label
  // is never empty.
  const fullAccountId = profile?.id ?? user?.id ?? null;
  const accountId = accountNumber ?? formatAccountId(fullAccountId);
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  /**
   * Cabinets migrated to the unified 56px top bar own the mobile nav state (and
   * render the hamburger there). Cabinets that have not been migrated keep the
   * previous self-contained behaviour — local state plus a floating trigger —
   * so this refactor cannot regress admin/patient/seller/technician.
   */
  const shell = useCabinetShell();
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  // Обои читаем после монтирования: в тестах и при серверном рендере
  // localStorage может отсутствовать.
  const [workspaceBackground, setWorkspaceBackground] =
    useState<WorkspaceBackground>("none");
  useEffect(() => {
    setWorkspaceBackground(readWorkspaceBackground());
  }, []);

  /**
   * Свёрнутые группы меню. Хранится список ЗАКРЫТЫХ групп, а не открытых:
   * пустой список = всё раскрыто, поэтому новая группа в меню появляется
   * открытой сама собой и ничего не прячется задним числом.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setCollapsedGroups(parsed.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      // Порченое значение или недоступное хранилище — просто держим всё раскрытым.
    }
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((current) => {
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];
      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // Приватный режим — сворачивание работает, просто не переживёт перезагрузку.
      }
      return next;
    });
  }, []);
  const mobileOpen = shell ? shell.navOpen : localMobileOpen;
  const setMobileOpen = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) => {
      const resolve = (previous: boolean) =>
        typeof next === "function" ? next(previous) : next;
      if (shell) shell.setNavOpen(resolve(shell.navOpen));
      else setLocalMobileOpen(resolve);
    },
    [shell],
  );

  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileNavigationId = "role-sidebar-mobile-navigation";
  const mobileInertProps = mobileOpen ? {} : { inert: "" };
  const isDark = theme === "dark";

  /**
   * The element focus returns to when the drawer closes. Either our own
   * floating trigger, or — in a migrated cabinet — the hamburger inside the top
   * bar, found by the `aria-controls` link it already declares.
   */
  const findTrigger = useCallback((): HTMLElement | null => {
    if (ownTriggerRef.current) return ownTriggerRef.current;
    return document.querySelector<HTMLElement>(
      `[aria-controls="${mobileNavigationId}"]`,
    );
  }, []);

  const closeMobileNavigation = useCallback(
    (restoreFocus = false) => {
      setMobileOpen(false);

      if (restoreFocus) {
        findTrigger()?.focus();
      }
    },
    [findTrigger, setMobileOpen],
  );

  useEffect(() => {
    if (!mobileOpen) return;

    const getTrapItems = () => {
      const trigger = findTrigger();
      const drawer = mobileDrawerRef.current;
      if (!trigger || !drawer) return [];

      return [
        trigger,
        ...Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)),
      ];
    };

    const isOwnedPortalTarget = (target: HTMLElement) =>
      Boolean(target.closest('[role="menu"]'));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation(true);
        return;
      }

      if (event.key !== "Tab") return;
      if (
        event.target instanceof HTMLElement &&
        isOwnedPortalTarget(event.target)
      ) {
        return;
      }

      const trapItems = getTrapItems();
      if (trapItems.length === 0) return;

      const firstItem = trapItems[0];
      const lastItem = trapItems[trapItems.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstItem ||
          !trapItems.includes(activeElement as HTMLElement))
      ) {
        event.preventDefault();
        lastItem.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastItem ||
          !trapItems.includes(activeElement as HTMLElement))
      ) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      const drawer = mobileDrawerRef.current;
      const trigger = findTrigger();
      if (!(target instanceof HTMLElement) || !drawer || !trigger) return;
      if (
        target === trigger ||
        drawer.contains(target) ||
        isOwnedPortalTarget(target)
      ) {
        return;
      }

      trigger.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [closeMobileNavigation, findTrigger, mobileOpen]);

  const handleLogout = useMemo(
    () => onLogout ?? (() => signOut()),
    [onLogout, signOut],
  );

  // Split "Мадина Рахимова" → first row = "Мадина", second row = "Рахимова".
  // Middle names get appended to the second row.
  /** Инициалы для кружка: первые буквы имени и фамилии, максимум две. */
  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  }, [displayName]);

  const { firstName, restName } = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || displayName,
      restName: parts.slice(1).join(" "),
    };
  }, [displayName]);

  // Normalize flat lists into a single unlabeled group so the render path is
  // uniform. Cabinets with many items pass grouped form for visual separation.
  const groups: RoleSidebarNavGroup[] = useMemo(
    () => (isGrouped(items) ? items : [{ items }]),
    [items],
  );

  /**
   * Which single item is "current". Resolved here, for the whole menu at once,
   * rather than per item — because several items legitimately cover the same
   * url (`/crm` covers `/crm/patients/123`, and so does `/crm/patients`) and
   * the MOST SPECIFIC one has to win. Deciding per item is what previously let
   * either zero or several items light up.
   */
  const activePath = useMemo(() => {
    const { pathname } = location;
    let bestPath: string | null = null;
    let bestScore = 0;

    for (const group of groups) {
      for (const item of group.items) {
        for (const candidate of item.matchPaths ?? [item.path]) {
          // `end` applies to the item's own canonical path only: it exists so
          // the dashboard (`/crm`) does not swallow every child route.
          const exact = item.end && candidate === item.path;
          const hit = exact
            ? pathname === candidate
            : pathname === candidate || pathname.startsWith(candidate + "/");
          if (hit && candidate.length > bestScore) {
            bestScore = candidate.length;
            bestPath = item.path;
          }
        }
      }
    }
    return bestPath;
  }, [groups, location]);

  const Body = (
    <>
      {/*
        Brand row, then identity row.
        The wordmark cannot share a line with the identity block: the sidebar is
        256px, and the mark + "PRODENT" + the role badge would leave about six
        characters for the user's name before it truncates. Its own row also
        reads in the right order — whose product this is, then who you are.
      */}
      <div className="border-b border-sidebar-border shrink-0">
        <Link
          to="/"
          className="mx-3 inline-flex min-h-11 min-w-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
        >
          <BrandMark size="sm" tone="sidebar" />
        </Link>
        {/*
          Name owns its own lines, then the id and the role badge share the row
          below. Putting the badge beside a name that wraps to two lines left it
          floating against nothing; on its own baseline it lands in the same
          place for every user, short name or long.
        */}
        {/* Блок пользователя по макету: кружок с инициалами, имя одной строкой,
            под ним должность. Раньше имя занимало две строки, а ниже стояли
            номер счёта и плашка роли — три строки на то, что читается один раз
            за сессию. Номер счёта остался: он нужен в разговоре с поддержкой,
            но ушёл в третью строку и перестал спорить с именем за место. */}
        <div className="flex items-center gap-2.5 px-3 pb-3">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-xs font-semibold text-sidebar-text"
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1" title={displayName}>
            <div className="truncate text-[13px] font-semibold leading-tight text-sidebar-text">
              {displayName}
            </div>
            <div className="truncate text-meta leading-tight text-sidebar-muted">
              {roleLabel}
            </div>
            {accountId && (
              <div
                className="select-all truncate font-mono text-xs leading-tight text-sidebar-muted"
                title={fullAccountId ?? undefined}
              >
                ID {accountId}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        aria-label={roleLabel}
        className="flex-1 overflow-y-auto p-2 scrollbar-thin"
      >
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : undefined}>
            {/* Full-opacity muted: the /70 variant measured 4.05:1 at 12px
                semibold, just under AA. --sidebar-text-muted is 6.44:1
                on the panel — measured live after the palette change. */}
            {group.label && (
              // Заголовок группы — кнопка сворачивания. В меню до 24 пунктов,
              // и они не помещаются на экран ноутбука ни при какой плотности.
              // Свёрнутое состояние запоминается, по умолчанию всё раскрыто —
              // у тех, кто ничего не сворачивал, меню выглядит как раньше.
              <button
                type="button"
                onClick={() => toggleGroup(group.label as string)}
                aria-expanded={!collapsedGroups.includes(group.label)}
                className="mb-1 flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.08em] text-sidebar-muted transition-colors hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent"
              >
                <span className="truncate">{group.label}</span>
                <span className="tabular-nums opacity-70">{group.items.length}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "ml-auto h-3.5 w-3.5 shrink-0 transition-transform",
                    collapsedGroups.includes(group.label) && "-rotate-90",
                  )}
                />
              </button>
            )}
            <div
              className={cn(
                "space-y-0.5",
                group.label && collapsedGroups.includes(group.label) && "hidden",
              )}
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  // Plain `Link`, not `NavLink` — and that is load-bearing.
                  // NavLink OWNS aria-current: it emits it only when its own
                  // `to`-matching says active, and silently drops the prop
                  // otherwise. Our active state comes from `matchPaths` (the
                  // same page is mounted under /crm/* and /doctor/*), so on an
                  // alias route NavLink stripped aria-current="page" while the
                  // visual highlight worked — sighted users saw the section,
                  // screen readers did not. Caught live; the unit tests only
                  // exercised canonical paths where the two matchers agree.
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      // Плотность из макета: 38px на мыши. На касании класс
                      // sidebar-nav-item возвращает 44px (см. index.css) —
                      // палец меньшую цель не берёт.
                      "sidebar-nav-item relative flex min-h-[2.375rem] w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent",
                      // Active state carries THREE cues, not just colour:
                      // brand-teal fill (white on it = 5.8:1), bold weight
                      // and a left indicator bar (WCAG 1.4.1 — never rely on
                      // colour alone to say "you are here").
                      isActive
                        ? "bg-sidebar-active font-semibold text-sidebar-text before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-accent"
                        : "font-medium text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-[18px] w-[18px] shrink-0"
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground tabular-nums">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {extra && <div className="mt-4 px-1">{extra}</div>}
      </nav>

      {/* Footer — theme toggle, language switcher, logout. Spread across the
          row so the three controls share width evenly. */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <div className="flex items-center justify-around gap-1">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="grid h-11 min-w-11 flex-1 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent"
            title={
              isDark
                ? t("roleSidebar.switchToLightTheme")
                : t("roleSidebar.switchToDarkTheme")
            }
            aria-label={
              isDark
                ? t("roleSidebar.switchToLightTheme")
                : t("roleSidebar.switchToDarkTheme")
            }
          >
            {isDark ? (
              <Sun aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Moon aria-hidden="true" className="h-4 w-4" />
            )}
          </button>

          {/* Обои рабочего пространства. Стоят рядом с темой, потому что это
              такая же личная настройка оформления, и рядом же их ищут. В меню
              пункт «Настройки» виден только с правами администратора клиники,
              поэтому врач иначе до этой настройки не добрался бы. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-11 min-w-11 flex-1 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent"
                title={t("roleSidebar.workspaceBackground")}
                aria-label={t("roleSidebar.workspaceBackground")}
              >
                <Image aria-hidden="true" className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="min-w-[190px]">
              {WORKSPACE_BACKGROUNDS.map((value) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    setWorkspaceBackground(value);
                    writeWorkspaceBackground(value);
                  }}
                  className={cn(
                    "min-h-11 cursor-pointer gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    workspaceBackground === value && "bg-accent",
                  )}
                >
                  <span>{t(`roleSidebar.workspaceBackground_${value}`)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent"
                title={t("nav.language") || "Language"}
                aria-label={t("roleSidebar.switchLanguage")}
              >
                <Globe aria-hidden="true" className="h-4 w-4" />
                <span className="text-[13px] leading-none">
                  {languageFlags[language]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              side="top"
              className="min-w-[160px]"
            >
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "min-h-11 cursor-pointer gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    language === lang && "bg-accent",
                  )}
                >
                  <span className="text-lg">{languageFlags[lang]}</span>
                  <span>{languageNames[lang]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={handleLogout}
            className="grid h-11 min-w-11 flex-1 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-accent"
            title={t("nav.logout") || "Logout"}
            aria-label={t("roleSidebar.logout")}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Un-migrated cabinets only: a floating trigger plus the 64px strip that
          exists purely as its backdrop. Migrated cabinets render the hamburger
          inside `CabinetTopBar` instead, which is how the phone reclaims 64px
          of pure chrome. Do not add these back — reserve space in the bar. */}
      {!shell && (
        <>
          <div
            data-testid="role-sidebar-mobile-toolbar"
            className="fixed inset-x-0 top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
          />

          <Button
            ref={ownTriggerRef}
            type="button"
            variant="outline"
            size="icon"
            className="fixed left-4 top-2.5 z-50 h-11 w-11 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={t("roleSidebar.toggleNavigation")}
            aria-expanded={mobileOpen}
            aria-controls={mobileNavigationId}
          >
            {mobileOpen ? (
              <X aria-hidden="true" className="h-4 w-4" />
            ) : (
              <MenuIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </Button>
        </>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-sidebar/50 backdrop-blur-sm lg:hidden"
          onClick={() => closeMobileNavigation(true)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        ref={mobileDrawerRef}
        id={mobileNavigationId}
        data-testid="role-sidebar-mobile"
        role="dialog"
        aria-label={roleLabel}
        aria-modal={mobileOpen ? "true" : undefined}
        aria-hidden={!mobileOpen}
        {...mobileInertProps}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-dvh w-64 max-w-[calc(100vw-4rem)] flex-col",
          "bg-sidebar border-r border-sidebar-border",
          "transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {Body}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col lg:flex",
          "bg-sidebar border-r border-sidebar-border",
        )}
      >
        {Body}
      </aside>
    </>
  );
}

/**
 * Layout shell paired with RoleSidebar — guarantees the same content-area
 * offset across every cabinet (`lg:pl-64`) and consistent main padding.
 */
export function RoleLayoutShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground">
      {sidebar}
      <main className="min-w-0 max-w-full pt-16 lg:pl-64 lg:pt-0">
        <div className="min-h-screen min-w-0 max-w-full p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
