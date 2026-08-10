import type { Notification } from "@/hooks/useNotifications";
import {
  CABINET_SECTIONS,
  type CabinetSectionKey,
  sectionForPath,
} from "@/lib/cabinet-routes";

/**
 * Sidebar "+N" badges, derived from the single live notification feed.
 *
 * Rather than running a counter query per menu item, every UNREAD notification
 * is bucketed onto exactly ONE cabinet section, and the bucket size becomes the
 * red badge next to that menu item. Which type belongs to which section is
 * declared once, in `lib/cabinet-routes.ts` — this file only counts.
 *
 * Buckets used to be keyed by `/crm/*` paths, which meant reading messages at
 * `/doctor/messages` never cleared the Messages badge: the doctor saw a
 * permanent red "3" and, within a week, learned to ignore all badges. Keying by
 * SECTION (which knows both url namespaces) is what fixes that.
 *
 * Types with no natural home (e.g. `general`) get no badge.
 */

/** Reverse index built once: notification type -> cabinet section. */
const TYPE_TO_SECTION: Record<string, CabinetSectionKey> = (() => {
  const acc: Record<string, CabinetSectionKey> = {};
  for (const key of Object.keys(CABINET_SECTIONS) as CabinetSectionKey[]) {
    for (const type of CABINET_SECTIONS[key].notificationTypes ?? []) {
      acc[type] = key;
    }
  }
  return acc;
})();

export type NavBadgeCounts = Partial<Record<CabinetSectionKey, number>>;

/**
 * Count UNREAD notifications per section. Sections with nothing to show are
 * absent, so `counts[section]` is `undefined` and the sidebar hides the badge.
 */
export function computeNavBadges(
  notifications: Notification[],
): NavBadgeCounts {
  const counts: NavBadgeCounts = {};
  for (const n of notifications) {
    if (n.read) continue;
    const section = TYPE_TO_SECTION[n.type];
    if (!section) continue;
    counts[section] = (counts[section] ?? 0) + 1;
  }
  return counts;
}

/**
 * The notification types belonging to whatever section the given route is in —
 * across BOTH url namespaces and child routes, so `/doctor/messages/42` clears
 * the same badge as `/crm/messages`. Used to mark a section read once the user
 * actually opens it.
 */
export function sectionTypesForPath(
  pathname: string,
): readonly string[] | undefined {
  const key = sectionForPath(pathname);
  if (!key) return undefined;
  const types = CABINET_SECTIONS[key].notificationTypes;
  return types?.length ? types : undefined;
}
