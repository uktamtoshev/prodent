import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Shell state shared between the cabinet frame and the page inside it.
 *
 * Two jobs:
 *
 * 1. ONE mobile navigation trigger. The hamburger used to live inside
 *    `RoleSidebar` as a `fixed` button, which forced a 64px decorative strip
 *    behind it; that strip plus the notification bar plus the page's own
 *    `DoctorTopbar` stacked to 184px of chrome before the first pixel of
 *    content on a phone. Lifting the open/closed state up here lets a single
 *    56px bar own the trigger.
 *
 * 2. ONE page header. Pages publish their title/subtitle/search here instead of
 *    rendering a second header of their own, so a screen can no longer show two
 *    `h1`s and two notification bells that lead to two different pages.
 *
 * The context is OPTIONAL by design: cabinets that have not been migrated
 * (admin, patient, seller, technician) render `RoleSidebar` without a provider
 * and keep their previous behaviour untouched.
 */

export interface CabinetPageChrome {
  /** Overrides the section name derived from the route. */
  title?: string;
  subtitle?: string;
  /** When set, the bar shows a search field wired to this handler. */
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

/** Nav entry as the sidebar already resolved it, permissions included. */
export interface CabinetNavEntry {
  title: string;
  path: string;
  group?: string;
}

interface CabinetShellValue {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  /**
   * The cabinet's reachable destinations, published by the sidebar.
   *
   * The command palette consumes THIS rather than re-deriving the menu: the
   * sidebar has already dropped every item the user lacks permission for, and a
   * palette that rebuilt the list independently would drift and start offering
   * sections the viewer cannot open.
   */
  navEntries: CabinetNavEntry[];
  publishNavEntries: (entries: CabinetNavEntry[]) => void;
  chrome: CabinetPageChrome;
  publishChrome: (chrome: CabinetPageChrome | null) => void;
  /**
   * DOM node in the top bar that pages portal their action buttons into.
   * A portal rather than a context value because action buttons are React
   * nodes: putting a freshly-created node into state on every render would
   * re-render the whole shell in a loop.
   */
  actionsSlot: HTMLElement | null;
  setActionsSlot: (node: HTMLElement | null) => void;
}

const CabinetShellContext = createContext<CabinetShellValue | null>(null);

export function CabinetShellProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [navEntries, setNavEntries] = useState<CabinetNavEntry[]>([]);
  const [chrome, setChrome] = useState<CabinetPageChrome>({});
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  const publishChrome = useCallback((next: CabinetPageChrome | null) => {
    setChrome(next ?? {});
  }, []);

  const publishNavEntries = useCallback((entries: CabinetNavEntry[]) => {
    // Compare by content: the sidebar re-memoizes on language change, and an
    // identity-only check would re-render the whole shell on every pass.
    setNavEntries((previous) => {
      const same =
        previous.length === entries.length &&
        previous.every(
          (item, i) => item.path === entries[i].path && item.title === entries[i].title,
        );
      return same ? previous : entries;
    });
  }, []);

  const value = useMemo(
    () => ({
      navOpen,
      setNavOpen,
      navEntries,
      publishNavEntries,
      chrome,
      publishChrome,
      actionsSlot,
      setActionsSlot,
    }),
    [navOpen, navEntries, publishNavEntries, chrome, publishChrome, actionsSlot],
  );

  return (
    <CabinetShellContext.Provider value={value}>
      {children}
    </CabinetShellContext.Provider>
  );
}

/** Shell access, or `null` outside a migrated cabinet. */
export function useCabinetShell(): CabinetShellValue | null {
  return useContext(CabinetShellContext);
}

/**
 * Publish this page's header into the cabinet top bar.
 *
 * Only primitives and a callback are accepted, so the effect can depend on
 * their values directly and settle after one pass. Action buttons go through
 * `CabinetTopBarActions` instead.
 *
 * No-op outside a migrated cabinet, so a page can call it unconditionally.
 */
export function usePageChrome({
  title,
  subtitle,
  onSearch,
  searchPlaceholder,
}: CabinetPageChrome): void {
  const shell = useCabinetShell();
  const publish = shell?.publishChrome;

  useEffect(() => {
    if (!publish) return;
    publish({ title, subtitle, onSearch, searchPlaceholder });
    // Clear on unmount so the next page does not inherit a stale title.
    return () => publish(null);
  }, [publish, title, subtitle, onSearch, searchPlaceholder]);
}
