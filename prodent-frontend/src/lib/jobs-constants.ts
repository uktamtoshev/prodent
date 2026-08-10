import { tGlobal } from "@/contexts/LanguageContext";
import { languageRuntime } from "@/i18n/language-runtime";
import type { Language } from "@/i18n/types";

type Translator = (key: string) => string;

const CATEGORY_KEYS: Record<string, string> = {
  dentist_therapist: "jobs.category.dentistTherapist",
  dentist_surgeon: "jobs.category.dentistSurgeon",
  dentist_orthopedist: "jobs.category.dentistOrthopedist",
  dentist_orthodontist: "jobs.category.dentistOrthodontist",
  dentist_periodontist: "jobs.category.dentistPeriodontist",
  dentist_pediatric: "jobs.category.dentistPediatric",
  dentist_implantologist: "jobs.category.dentistImplantologist",
  dental_assistant: "jobs.category.dentalAssistant",
  nurse: "jobs.category.nurse",
  orderly: "jobs.category.orderly",
  reception_admin: "jobs.category.receptionAdmin",
  dental_technician: "jobs.category.dentalTechnician",
  chair_rental: "jobs.category.chairRental",
  other: "jobs.category.other",
};

const EMPLOYMENT_KEYS: Record<string, string> = {
  full_time: "jobs.employment.fullTime",
  part_time: "jobs.employment.partTime",
  shift: "jobs.employment.shift",
  gig: "jobs.employment.gig",
};

const COOPERATION_KEYS: Record<string, string> = {
  staff_doctor: "jobs.cooperation.staffDoctor",
  chair_rental: "jobs.cooperation.chairRental",
};

const SALARY_MODE_KEYS: Record<string, string> = {
  percent: "jobs.salaryMode.percent",
  fixed: "jobs.salaryMode.fixed",
  agreement: "jobs.salaryMode.agreement",
  intern: "jobs.salaryMode.intern",
};

const RENTAL_PERIOD_KEYS: Record<string, string> = {
  daily: "jobs.rentalPeriod.daily",
  weekly: "jobs.rentalPeriod.weekly",
  monthly: "jobs.rentalPeriod.monthly",
};

const APPLICATION_STATUS_KEYS: Record<string, string> = {
  new: "jobs.applicationStatus.new",
  viewed: "jobs.applicationStatus.viewed",
  shortlisted: "jobs.applicationStatus.shortlisted",
  interview: "jobs.applicationStatus.interview",
  offer: "jobs.applicationStatus.offer",
  accepted: "jobs.applicationStatus.accepted",
  rejected: "jobs.applicationStatus.rejected",
  withdrawn: "jobs.applicationStatus.withdrawn",
};

// Ordered funnel for the application progress bar (terminal states excluded).
export const APPLICATION_FUNNEL = ["new", "viewed", "shortlisted", "interview", "offer", "accepted"];

// Status tones — kept within the PRODENT palette: teal (brand), sky (tashkent-sky),
// amber (warning), green (success), red (destructive) and neutral muted. No
// off-brand violet/indigo. `offer` is a solid teal to mark the strongest step.
export const APPLICATION_STATUS_TONE: Record<string, string> = {
  new: "bg-tashkent-sky/10 text-tashkent-sky",
  viewed: "bg-muted text-muted-foreground",
  shortlisted: "bg-brand-50 text-brand-700",
  interview: "bg-warning-amber/15 text-warning-amber",
  offer: "bg-brand text-white",
  accepted: "bg-success-green/15 text-success-green",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground/70",
};

// Solid dot colours for the dated status timeline (same on-brand hues).
export const APPLICATION_STATUS_DOT: Record<string, string> = {
  new: "bg-tashkent-sky",
  viewed: "bg-muted-foreground/50",
  shortlisted: "bg-brand",
  interview: "bg-warning-amber",
  offer: "bg-brand-700",
  accepted: "bg-success-green",
  rejected: "bg-destructive",
  withdrawn: "bg-muted-foreground/50",
};

// Categories grouped for the post form / filters.
function localizedRecord(
  keys: Record<string, string>,
): Record<string, string> {
  return new Proxy(keys, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      return typeof value === "string" ? tGlobal(value) : value;
    },
  });
}

function localizedOptions(
  keys: Record<string, string>,
  t: Translator = tGlobal,
) {
  return Object.entries(keys).map(([value, key]) => ({
    value,
    label: t(key),
  }));
}

export const CATEGORY_LABELS = localizedRecord(CATEGORY_KEYS);
export const EMPLOYMENT_LABELS = localizedRecord(EMPLOYMENT_KEYS);
export const COOPERATION_LABELS = localizedRecord(COOPERATION_KEYS);
export const SALARY_MODE_LABELS = localizedRecord(SALARY_MODE_KEYS);
export const RENTAL_PERIOD_LABELS = localizedRecord(RENTAL_PERIOD_KEYS);
export const APPLICATION_STATUS_LABELS = localizedRecord(
  APPLICATION_STATUS_KEYS,
);

export const getCategoryOptions = (t: Translator = tGlobal) =>
  localizedOptions(CATEGORY_KEYS, t);
export const getEmploymentOptions = (t: Translator = tGlobal) =>
  localizedOptions(EMPLOYMENT_KEYS, t);
export const getCooperationOptions = (t: Translator = tGlobal) =>
  localizedOptions(COOPERATION_KEYS, t);
export const getSalaryModeOptions = (t: Translator = tGlobal) =>
  localizedOptions(SALARY_MODE_KEYS, t);

// Backwards-compatible options for forms not yet migrated to explicit t().
// Labels are resolved lazily whenever React reads the option.
function lazyOptions(keys: Record<string, string>) {
  return Object.entries(keys).map(([value, key]) => {
    const option = { value } as { value: string; label: string };
    Object.defineProperty(option, "label", {
      enumerable: true,
      get: () => tGlobal(key),
    });
    return option;
  });
}

export const CATEGORY_OPTIONS = lazyOptions(CATEGORY_KEYS);
export const EMPLOYMENT_OPTIONS = lazyOptions(EMPLOYMENT_KEYS);
export const COOPERATION_OPTIONS = lazyOptions(COOPERATION_KEYS);
export const SALARY_MODE_OPTIONS = lazyOptions(SALARY_MODE_KEYS);

export const catLabel = (c?: string, t: Translator = tGlobal) =>
  (c && CATEGORY_KEYS[c] && t(CATEGORY_KEYS[c])) || c || "—";
export const empLabel = (e?: string, t: Translator = tGlobal) =>
  (e && EMPLOYMENT_KEYS[e] && t(EMPLOYMENT_KEYS[e])) || "";
export const coopLabel = (c?: string, t: Translator = tGlobal) =>
  (c && COOPERATION_KEYS[c] && t(COOPERATION_KEYS[c])) || "";

const numberLocales: Record<Language, string> = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
};

/** Human salary line from a listing's salary fields. */
export function salaryText(l: {
  listing_type?: string | null;
  cooperation_type?: string | null;
  salary_mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_percent?: number | null;
  rental_fee?: number | null;
  rental_period?: string | null;
  currency?: string | null;
}, t: Translator = tGlobal, language: Language = languageRuntime.getLanguage()): string {
  const cur = l.currency || "UZS";
  const fmt = (n: number) => new Intl.NumberFormat(numberLocales[language]).format(n);
  if (l.cooperation_type === "chair_rental" || l.listing_type === "chair_rental") {
    if (l.rental_fee != null) {
      const periodKey = RENTAL_PERIOD_KEYS[l.rental_period || ""];
      return `${t("jobs.salary.rent")}: ${fmt(l.rental_fee)} ${cur} ${
        periodKey ? t(periodKey) : ""
      }`.trim();
    }
    return t("jobs.salary.rentAgreement");
  }
  if (l.salary_mode === "percent" && l.salary_percent != null) {
    return `${l.salary_percent}% ${t("jobs.salary.revenuePercent")}`;
  }
  if (l.salary_mode === "agreement") return t("jobs.salary.agreement");
  if (l.salary_mode === "intern") return t("jobs.salary.intern");
  if (l.salary_min != null && l.salary_max != null) return `${fmt(l.salary_min)} – ${fmt(l.salary_max)} ${cur}`;
  if (l.salary_min != null) return `${t("jobs.salary.from")} ${fmt(l.salary_min)} ${cur}`;
  if (l.salary_max != null) return `${t("jobs.salary.to")} ${fmt(l.salary_max)} ${cur}`;
  return t("jobs.salary.agreement");
}
