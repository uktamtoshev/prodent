import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileQuestion,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Language, useLanguage } from "@/contexts/LanguageContext";
import {
  PublicTreatmentPlan,
  TreatmentPlanLinkError,
  TreatmentPlanStatus,
  resolvePublicTreatmentPlan,
} from "@/lib/treatment-plan-links";

const LOCALES: Record<Language, string> = {
  ru: "ru-RU",
  uz: "uz-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; plan: PublicTreatmentPlan }
  | { kind: "not-found" }
  | { kind: "error" };

function readTokenFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const token = new URLSearchParams(fragment).get("t")?.trim() ?? "";
  return token.length > 0 && token.length <= 512 ? token : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function StateCard({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
            {icon}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{text}</p>
          {action && <div className="mt-6">{action}</div>}
        </CardContent>
      </Card>
    </main>
  );
}

export default function TreatmentPlanPublic() {
  const { language, t } = useLanguage();
  const tokenRef = useRef<string | null>(readTokenFromFragment());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(() =>
    tokenRef.current ? { kind: "loading" } : { kind: "not-found" },
  );

  // A fragment never reaches the server. Remove it before paint so the secret
  // does not remain in the address bar, browser history or copied page URL.
  useLayoutEffect(() => {
    if (!window.location.hash) return;
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) {
      setState({ kind: "not-found" });
      return;
    }

    const controller = new AbortController();
    setState({ kind: "loading" });
    resolvePublicTreatmentPlan(token, controller.signal)
      .then((plan) => {
        tokenRef.current = null;
        setState({ kind: "ready", plan });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (error instanceof TreatmentPlanLinkError && error.status === 404) {
          tokenRef.current = null;
          setState({ kind: "not-found" });
          return;
        }
        setState({ kind: "error" });
      });

    return () => controller.abort();
  }, [attempt]);

  const locale = LOCALES[language];
  const formatDate = (value: string | null): string => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  };
  const formatMoney = (value: number, currency: string): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "UZS" ? 0 : 2,
      }).format(value);
    } catch {
      return `${new Intl.NumberFormat(locale).format(value)} ${currency}`;
    }
  };
  const statusLabel = (status: TreatmentPlanStatus): string => {
    const keys: Record<TreatmentPlanStatus, string> = {
      PLANNED: "treatmentPlanPublic.statusPlanned",
      IN_PROGRESS: "treatmentPlanPublic.statusInProgress",
      COMPLETED: "treatmentPlanPublic.statusCompleted",
      CANCELLED: "treatmentPlanPublic.statusCancelled",
    };
    return t(keys[status]);
  };
  const statusClass = (status: TreatmentPlanStatus): string => {
    const classes: Record<TreatmentPlanStatus, string> = {
      PLANNED: "border-sky-200 bg-sky-50 text-sky-700",
      IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
      COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
      CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
    };
    return classes[status];
  };

  if (state.kind === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
        <span className="sr-only" role="status">{t("treatmentPlanPublic.loading")}</span>
        <div className="mx-auto max-w-4xl space-y-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="ml-auto h-28 w-full rounded-2xl sm:w-80" />
        </div>
      </main>
    );
  }

  if (state.kind === "not-found") {
    return (
      <StateCard
        icon={<FileQuestion className="h-7 w-7" aria-hidden="true" />}
        title={t("treatmentPlanPublic.notFoundTitle")}
        text={t("treatmentPlanPublic.notFoundText")}
      />
    );
  }

  if (state.kind === "error") {
    return (
      <StateCard
        icon={<AlertCircle className="h-7 w-7 text-rose-600" aria-hidden="true" />}
        title={t("treatmentPlanPublic.errorTitle")}
        text={t("treatmentPlanPublic.errorText")}
        action={
          <Button onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("treatmentPlanPublic.retry")}
          </Button>
        }
      />
    );
  }

  const { plan } = state;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-800">
            <ShieldCheck className="h-5 w-5 text-teal-600" aria-hidden="true" />
            PRODENT
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {t("treatmentPlanPublic.secureDocument")}
          </div>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
          <CardHeader className="space-y-5 p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{plan.clinicName}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {plan.title}
                </h1>
              </div>
              <Badge variant="outline" className={`w-fit whitespace-nowrap ${statusClass(plan.status)}`}>
                {plan.status === "COMPLETED" && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                {statusLabel(plan.status)}
              </Badge>
            </div>

            <dl className="grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="flex items-center gap-1.5 text-slate-500">
                  <Stethoscope className="h-4 w-4" aria-hidden="true" />
                  {t("treatmentPlanPublic.doctor")}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">{plan.doctorName}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-slate-500">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {t("treatmentPlanPublic.created")}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">{formatDate(plan.createdAt)}</dd>
              </div>
              {plan.approvedAt && (
                <div>
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {t("treatmentPlanPublic.approved")}
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">{formatDate(plan.approvedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="flex items-center gap-1.5 text-slate-500">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  {t("treatmentPlanPublic.linkValidUntil")}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">{formatDate(plan.expiresAt)}</dd>
              </div>
            </dl>
          </CardHeader>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <FileText className="h-5 w-5 text-teal-600" aria-hidden="true" />
              {t("treatmentPlanPublic.services")}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {plan.items.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                {t("treatmentPlanPublic.noItems")}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium">{t("treatmentPlanPublic.position")}</th>
                        <th className="px-3 py-3 text-left font-medium">{t("treatmentPlanPublic.tooth")}</th>
                        <th className="px-3 py-3 text-left font-medium">{t("treatmentPlanPublic.procedure")}</th>
                        <th className="px-3 py-3 text-center font-medium">{t("treatmentPlanPublic.quantity")}</th>
                        <th className="px-3 py-3 text-right font-medium">{t("treatmentPlanPublic.unitPrice")}</th>
                        <th className="px-5 py-3 text-right font-medium">{t("treatmentPlanPublic.amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plan.items.map((item, index) => (
                        <tr key={`${item.position}-${item.description}-${index}`} className="text-slate-700">
                          <td className="px-5 py-4 tabular-nums text-slate-500">{item.position}</td>
                          <td className="px-3 py-4 tabular-nums">{item.toothNumber ?? "—"}</td>
                          <td className="px-3 py-4">
                            <div className="font-medium text-slate-900">{item.description}</div>
                            <div className="mt-1 text-xs text-slate-500">{statusLabel(item.status)}</div>
                          </td>
                          <td className="px-3 py-4 text-center tabular-nums">{item.quantity}</td>
                          <td className="px-3 py-4 text-right tabular-nums">{formatMoney(item.unitPrice, plan.currency)}</td>
                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                            {formatMoney(item.totalPrice, plan.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {plan.items.map((item, index) => (
                    <article key={`${item.position}-${item.description}-${index}`} className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500">
                            {t("treatmentPlanPublic.position")} {item.position}
                            {item.toothNumber !== null && ` · ${t("treatmentPlanPublic.tooth")} ${item.toothNumber}`}
                          </div>
                          <h2 className="mt-1 font-medium text-slate-950">{item.description}</h2>
                        </div>
                        <Badge variant="outline" className={statusClass(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                        <div>
                          <dt className="text-slate-500">{t("treatmentPlanPublic.quantity")}</dt>
                          <dd className="mt-1 font-medium tabular-nums text-slate-900">{item.quantity}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">{t("treatmentPlanPublic.unitPrice")}</dt>
                          <dd className="mt-1 font-medium tabular-nums text-slate-900">{formatMoney(item.unitPrice, plan.currency)}</dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-slate-500">{t("treatmentPlanPublic.amount")}</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-slate-950">{formatMoney(item.totalPrice, plan.currency)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="ml-auto border-teal-200 bg-teal-50/70 shadow-sm sm:max-w-sm">
          <CardContent className="flex items-center justify-between gap-5 p-5">
            <span className="font-medium text-slate-700">{t("treatmentPlanPublic.total")}</span>
            <span className="text-xl font-bold tabular-nums text-teal-800">
              {formatMoney(plan.totalCost, plan.currency)}
            </span>
          </CardContent>
        </Card>

        <p className="px-2 pb-4 text-center text-xs leading-5 text-slate-500">
          {t("treatmentPlanPublic.footer")}
        </p>
      </div>
    </main>
  );
}
