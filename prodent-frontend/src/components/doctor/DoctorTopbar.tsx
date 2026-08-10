import { ReactNode } from "react";
import { usePageChrome } from "@/components/shared/CabinetShellContext";
import { CabinetTopBarActions } from "@/components/shared/CabinetTopBar";

interface DoctorTopbarProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** @deprecated Search now lives in the cabinet top bar; pass `onSearch`. */
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  /** @deprecated The bar no longer renders here, so styling it has no effect. */
  className?: string;
}

/**
 * Publishes a doctor page's header into the cabinet's single top bar.
 *
 * This used to render its own 72px `<header>` with an `h1` AND a notification
 * bell pointing at `/doctor/notifications`, while the layout above it rendered
 * a second bell pointing at `/crm/notifications` — two bells and two `h1`s on
 * one screen, leading to two different pages. Stacked with the 64px decorative
 * strip and the 48px bell bar, a doctor on an iPhone SE lost 184px (31% of the
 * screen) before the first appointment row appeared.
 *
 * Now it renders nothing: title, subtitle and search go into `CabinetTopBar`
 * through the shell context, and action buttons portal into the same bar. The
 * seven call sites keep working unchanged, which is why this stayed a component
 * instead of becoming a hook.
 */
export const DoctorTopbar = ({
  title,
  subtitle,
  right,
  searchPlaceholder,
  onSearch,
}: DoctorTopbarProps) => {
  usePageChrome({ title, subtitle, onSearch, searchPlaceholder });

  if (!right) return null;
  return <CabinetTopBarActions>{right}</CabinetTopBarActions>;
};
