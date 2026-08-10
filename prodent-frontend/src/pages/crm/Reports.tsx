import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Banknote, RefreshCcw, ReceiptText, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPrice } from "@/lib/utils";
import {
  getReportSummary,
  listReportOperations,
} from "@/lib/crm-operations-api";

interface ReportSummary {
  payments: number;
  refunds: number;
  net: number;
  outstandingDebt: number;
  paymentCount: number;
  refundCount: number;
  appointments?: {
    appointment_count?: number;
    completed_count?: number;
    cancelled_count?: number;
    no_show_count?: number;
  };
}

interface Operation {
  id: string;
  event_type: "PAYMENT" | "REFUND";
  amount: number;
  currency: string;
  invoice_id?: string | null;
  payment_id?: string | null;
  refund_id?: string | null;
  invoice_number?: string | null;
  patient_name?: string | null;
  occurred_at: string;
}

const isoDay = (date: Date) => date.toLocaleDateString("en-CA");

export default function Reports() {
  const { language, t } = useLanguage();
  const { currentClinic } = useClinic();
  const [searchParams] = useSearchParams();
  const uz = language === "uz";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [from, setFrom] = useState(searchParams.get("from") || isoDay(monthStart));
  const [to, setTo] = useState(searchParams.get("to") || isoDay(now));
  const eventType = searchParams.get("type");
  const [cursor, setCursor] = useState<string | undefined>();

  const summary = useQuery({
    queryKey: ["s7-report-summary", currentClinic?.id, from, to],
    queryFn: () =>
      getReportSummary(currentClinic!.id, from, to) as Promise<ReportSummary>,
    enabled: !!currentClinic?.id && !!from && !!to,
  });
  const operations = useQuery({
    queryKey: ["s7-report-operations", currentClinic?.id, from, to, cursor],
    queryFn: () =>
      listReportOperations(currentClinic!.id, {
        from,
        to,
        cursor,
        size: 50,
      }) as Promise<Operation[]>,
    enabled: !!currentClinic?.id && !!from && !!to,
  });

  const cards = [
    {
      label: uz ? "To‘lovlar" : "Платежи",
      value: summary.data?.payments,
      count: summary.data?.paymentCount,
      icon: Banknote,
    },
    {
      label: uz ? "Qaytarishlar" : "Возвраты",
      value: summary.data?.refunds,
      count: summary.data?.refundCount,
      icon: RefreshCcw,
    },
    {
      label: uz ? "Sof tushum" : "Чистая выручка",
      value: summary.data?.net,
      icon: WalletCards,
    },
    {
      label: uz ? "Qarz" : "Задолженность",
      value: summary.data?.outstandingDebt,
      icon: ReceiptText,
    },
  ];
  const visibleOperations = (operations.data ?? []).filter((row) =>
    !eventType || row.event_type === eventType,
  );

  return (
    <CRMLayout>
      <PermissionGate module="reports">
        <div className="space-y-6 p-4 pb-24 md:p-6 lg:p-8">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crm.reportsShort")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {uz
                ? "Har bir summa asl operatsiyaga olib boradi"
                : "Каждая сумма ведёт к исходной операции"}
            </p>
          </div>
          {/* Периоды из макета — пресеты поверх тех же полей дат: запрос
              уже принимает диапазон, новых обращений не нужно. «Сравнение с
              клиникой» не сделано: для него нужен второй набор данных, а
              отчёт возвращает только один. */}
          <div className="flex flex-wrap items-center gap-0.5">
            {([
              { key: "month", label: uz ? "Oy" : "Месяц", days: 30 },
              { key: "quarter", label: uz ? "Chorak" : "Квартал", days: 90 },
              { key: "year", label: uz ? "Yil" : "Год", days: 365 },
            ]).map((preset) => {
              const start = new Date();
              start.setDate(start.getDate() - preset.days + 1);
              const startIso = start.toLocaleDateString("en-CA");
              const active = from === startIso;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFrom(startIso);
                    setTo(new Date().toLocaleDateString("en-CA"));
                    setCursor(undefined);
                  }}
                  className={cn(
                    "cabinet-control inline-flex items-center rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              {uz ? "Dan" : "С"}
              <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setCursor(undefined); }} />
            </label>
            <label className="text-xs text-muted-foreground">
              {uz ? "Gacha" : "По"}
              <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setCursor(undefined); }} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, count, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-card-x">
                  <div className="flex items-center gap-2 text-meta font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  {summary.isLoading ? (
                    <Skeleton className="mt-3 h-8 w-32" />
                  ) : (
                    <p className="mt-1 text-kpi tabular-nums font-heading">{formatPrice(Number(value || 0), "UZS", false)}</p>
                  )}
                  {count !== undefined && <p className="mt-1 text-xs text-muted-foreground">{count} {uz ? "operatsiya" : "операций"}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{uz ? "Asl operatsiyalar" : "Исходные операции"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {operations.isLoading ? (
                <Skeleton className="h-40" />
              ) : operations.isError ? (
                <div className="rounded-xl border border-destructive/30 p-5 text-center">
                  <p>{uz ? "Operatsiyalar yuklanmadi" : "Операции не загрузились"}</p>
                  <Button className="mt-3" variant="outline" onClick={() => void operations.refetch()}>
                    {uz ? "Qayta urinish" : "Повторить"}
                  </Button>
                </div>
              ) : visibleOperations.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3">{uz ? "Sana" : "Дата"}</th>
                          <th className="p-3">{uz ? "Turi" : "Тип"}</th>
                          <th className="p-3">{uz ? "Bemor" : "Пациент"}</th>
                          <th className="p-3">{uz ? "Hisob" : "Счёт"}</th>
                          <th className="p-3 text-right">{uz ? "Summa" : "Сумма"}</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOperations.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="p-3">{new Date(row.occurred_at).toLocaleString(language === "uz" ? "uz-UZ" : "ru-RU")}</td>
                            <td className="p-3"><Badge variant={row.event_type === "REFUND" ? "destructive" : "secondary"}>{row.event_type}</Badge></td>
                            <td className="p-3">{row.patient_name || "—"}</td>
                            <td className="p-3">{row.invoice_number || "—"}</td>
                            <td className="p-3 text-right font-medium">{formatPrice(Number(row.amount || 0), row.currency || "UZS", false)}</td>
                            <td className="p-3 text-right">
                              {row.invoice_id && (
                                <Button asChild size="sm" variant="ghost">
                                  <Link to={`/crm/finance?tab=invoices&invoice=${row.invoice_id}`}>
                                    {uz ? "Ochish" : "Открыть"} <ArrowRight className="ml-1 h-4 w-4" />
                                  </Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {operations.data.length === 50 && (
                    <Button variant="outline" onClick={() => setCursor(operations.data.at(-1)?.id)}>
                      {uz ? "Keyingi 50" : "Следующие 50"}
                    </Button>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                  {uz ? "Bu davrda operatsiyalar yo‘q" : "За этот период операций нет"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PermissionGate>
    </CRMLayout>
  );
}
