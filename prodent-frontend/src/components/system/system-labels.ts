import { languageRuntime } from "@/i18n/language-runtime";

/**
 * i18n bridge for the shared design-system layer.
 *
 * Why it exists: the labels were hardcoded Russian defaults ("Нет данных",
 * "Страница {page} из {pageCount}", "Перейти к содержимому"). PRODENT ships six
 * languages, so every screen migrated onto `DataTable` would have injected
 * Russian into the Uzbek, Kazakh, Kyrgyz and Tajik interface — adopting the
 * design system made those clinics' UI worse, which is much of why the layer sat
 * unused in one file out of 192.
 *
 * Why `tGlobal` and not `useLanguage()`:
 *
 *  - `useLanguage()` THROWS outside a `LanguageProvider`, and these primitives
 *    are deliberately provider-free so they can be unit-tested in isolation
 *    (`components/system/*.test.tsx`). A design-system primitive must not
 *    require the whole app to be mounted.
 *  - Reading the context object directly instead is worse: dozens of existing
 *    tests partially mock `@/contexts/LanguageContext` with just `useLanguage`,
 *    and any of them that happens to render a primitive would crash on the
 *    missing export. `tGlobal` touches only the translation runtime, so no test
 *    needs to know this hook exists.
 *
 * A language switch still updates these labels: `setLanguage` re-renders every
 * context consumer, the primitives re-render with them, and the getter below is
 * re-evaluated against the runtime's new dictionary.
 *
 * Keys live in the always-loaded `base` locale namespace under `system.*`.
 *
 * Precedence: an explicit prop beats this, and this beats the raw key.
 */

const KEY_PREFIX = "system.";

export type SystemLabelKey =
  | "skipToContent"
  | "confirm"
  | "cancel"
  | "noData"
  | "data"
  | "dataTable"
  | "scrollableTable"
  | "pagination"
  | "pageOf"
  | "prevPage"
  | "nextPage"
  | "clear"
  | "filters"
  | "search"
  | "actions"
  | "loading"
  | "steps"
  | "stepDone"
  | "timeline"
  | "loadingCabinet";

export type SystemLabelResolver = (
  key: SystemLabelKey,
  vars?: Record<string, string | number>,
) => string;

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Resolve a design-system label in the active language. */
export function useSystemLabel(): SystemLabelResolver {
  return (key, vars) => interpolate(languageRuntime.translate(`${KEY_PREFIX}${key}`), vars);
}
