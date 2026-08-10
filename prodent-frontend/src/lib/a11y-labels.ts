import { languageRuntime } from "@/i18n/language-runtime";

/**
 * Accessible names for icon-only controls.
 *
 * WCAG 4.1.2: a button whose only child is an `<svg>` has an empty accessible
 * name, so a screen reader announces "button" and nothing else. The cabinet had
 * 36 of these, including delete-service, delete-staff and delete-notification —
 * irreversible actions performed blind.
 *
 * Why a module-level function rather than the `t` from `useLanguage()`:
 * these buttons frequently live in small presentational sub-components that
 * receive their strings as a `labels` prop precisely because they never call
 * `useLanguage()`. An automated pass that inserted `t(...)` there produced
 * `ReferenceError: t is not defined` at runtime — and TypeScript did NOT catch
 * it, because a `t` existed in an enclosing module scope. A plain import is in
 * scope everywhere, in every nested component, with nothing to thread through.
 *
 * Keys live in the always-loaded `base` locale namespace under `a11y.*`.
 */
export type A11yLabelKey =
  | "more"
  | "close"
  | "prev"
  | "next"
  | "add"
  | "edit"
  | "delete"
  | "refresh"
  | "fullscreen"
  | "stop"
  | "record"
  | "play"
  | "reset"
  | "clinic"
  | "expand";

export function a11yLabel(key: A11yLabelKey): string {
  return languageRuntime.translate(`a11y.${key}`);
}
