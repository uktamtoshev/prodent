import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CreditCard,
  DoorOpen,
  FileText,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getClinicSchedule,
  getReportSummary,
  listClinicInvoices,
  listReportOperations,
  searchClinicPatients,
} from "@/lib/crm-operations-api";
import { sklad } from "@/lib/sklad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type JsonRow = Record<string, unknown>;

const text = (value: unknown, fallback = "—") =>
  typeof value === "string" && value.trim() ? value : fallback;
const number = (value: unknown) => Number(value) || 0;
const money = (value: unknown) =>
  `${number(value).toLocaleString("ru-RU")} сум`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

function Empty({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1 text-sm">{message}</span>
      <Button className="min-h-11" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
        Повторить
      </Button>
    </div>
  );
}

export function StaffPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to={action.href}>
            {action.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </header>
  );
}

export function ScheduleOperations({
  title,
  description,
  roomsOnly = false,
}: {
  title: string;
  description: string;
  roomsOnly?: boolean;
}) {
  const { currentClinic } = useClinic();
  const date = today();
  const query = useQuery({
    queryKey: ["s8-staff-schedule", currentClinic?.id, date],
    queryFn: () => getClinicSchedule(currentClinic!.id, date, date),
    enabled: Boolean(currentClinic?.id),
  });
  const rows = roomsOnly
    ? query.data?.rooms ?? []
    : query.data?.appointments ?? [];

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title={title}
        description={description}
        action={{ href: "/crm/schedule", label: "Открыть полный календарь" }}
      />
      {!currentClinic ? (
        <Empty>Сначала выберите клинику.</Empty>
      ) : query.isError ? (
        <ErrorState message="Не удалось загрузить расписание." onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Empty>Загружаем расписание…</Empty>
      ) : rows.length === 0 ? (
        <Empty>{roomsOnly ? "Кабинеты не настроены." : "На сегодня записей нет."}</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => {
            const id = text(row.id, String(index));
            const status = text(row.status, roomsOnly ? "ACTIVE" : "PLANNED");
            return (
              <Card key={id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {roomsOnly ? <DoorOpen className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {roomsOnly
                        ? text(row.name, `Кабинет ${index + 1}`)
                        : text(row.patient_name ?? row.patientName, `Запись ${index + 1}`)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {roomsOnly
                        ? text(row.chair_code ?? row.chairCode, "Кресло не указано")
                        : `${text(row.start_time ?? row.startTime, "Время не указано")} · ${text(row.doctor_name ?? row.doctorName, "Врач")}`}
                    </div>
                    <Badge variant="secondary" className="mt-2">{status}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PatientOperations() {
  const { currentClinic } = useClinic();
  const [queryText, setQueryText] = useState("");
  const normalized = queryText.trim();
  const query = useQuery({
    queryKey: ["s8-staff-patient-search", currentClinic?.id, normalized],
    queryFn: () => searchClinicPatients(currentClinic!.id, normalized),
    enabled: Boolean(currentClinic?.id) && normalized.length >= 2,
  });

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title="Пациенты"
        description="Безопасный поиск внутри выбранной клиники."
        action={{ href: "/crm/patients", label: "Полная карточка пациентов" }}
      />
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          className="pl-9"
          placeholder="Введите минимум 2 символа"
          aria-label="Поиск пациентов"
        />
      </div>
      {normalized.length < 2 ? (
        <Empty>Введите имя или телефон пациента.</Empty>
      ) : query.isError ? (
        <ErrorState message="Поиск временно недоступен." onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Empty>Ищем пациентов…</Empty>
      ) : !query.data?.length ? (
        <Empty>Пациенты не найдены.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {query.data.map((row, index) => (
            <Card key={text(row.id, String(index))}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {text(row.name ?? row.full_name ?? row.fullName, "Пациент")}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{text(row.phone, "Телефон не указан")}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function FinanceOperations({
  title,
  kind,
}: {
  title: string;
  kind: "invoices" | "payments";
}) {
  const { currentClinic } = useClinic();
  const query = useQuery({
    queryKey: ["s8-staff-finance", kind, currentClinic?.id],
    queryFn: () =>
      kind === "invoices"
        ? listClinicInvoices(currentClinic!.id)
        : listReportOperations(currentClinic!.id, {
            from: monthStart(),
            to: today(),
            size: 100,
          }),
    enabled: Boolean(currentClinic?.id),
  });
  const rows = useMemo(
    () =>
      kind === "payments"
        ? (query.data ?? []).filter((row) =>
            ["PAYMENT", "REFUND", "PAYMENT_RECORDED", "REFUND_RECORDED"].includes(
              text(row.event_type ?? row.operation_type ?? row.type, "").toUpperCase(),
            ),
          )
        : query.data ?? [],
    [kind, query.data],
  );

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title={title}
        description={kind === "invoices" ? "Счета выбранной клиники." : "Оплаты и возвраты за текущий месяц."}
        action={{ href: `/crm/finance?tab=${kind}`, label: "Открыть финансы" }}
      />
      {query.isError ? (
        <ErrorState message="Не удалось загрузить финансовые данные." onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Empty>Загружаем данные…</Empty>
      ) : rows.length === 0 ? (
        <Empty>Операций пока нет.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 50).map((row, index) => (
            <Card key={text(row.id, String(index))}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  {kind === "invoices" ? <FileText className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{text(row.number ?? row.invoice_number ?? row.event_type ?? row.operation_type ?? row.type, kind === "invoices" ? "Счёт" : "Операция")}</div>
                  <div className="text-sm text-muted-foreground">{text(row.status ?? row.created_at ?? row.occurred_at, "Без статуса")}</div>
                </div>
                <div className="font-semibold tabular-nums">{money(row.total ?? row.final_amount ?? row.amount)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function PerformanceOperations({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { currentClinic } = useClinic();
  const query = useQuery({
    queryKey: ["s8-staff-performance", currentClinic?.id, monthStart(), today()],
    queryFn: () => getReportSummary(currentClinic!.id, monthStart(), today()),
    enabled: Boolean(currentClinic?.id),
  });
  const data = query.data ?? {};
  const appointments =
    typeof data.appointments === "object" && data.appointments !== null
      ? (data.appointments as JsonRow).appointment_count
      : data.appointments;
  const cards = [
    ["Записи", appointments ?? data.appointment_count ?? data.appointments_count, CalendarDays],
    ["Оплаты", data.payments ?? data.paid ?? data.payments_total, CreditCard],
    ["Возвраты", data.refunds ?? data.refunds_total, RefreshCw],
    ["Долги", data.outstandingDebt ?? data.debts ?? data.debt ?? data.debts_total, TrendingUp],
  ] as const;

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title={title}
        description={description}
        action={{ href: "/crm/reports", label: "Подробный отчёт" }}
      />
      {query.isError ? (
        <ErrorState message="Не удалось загрузить показатели." onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map(([label, value, Icon]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <Icon className="h-5 w-5 text-primary" />
                <div className="mt-3 text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  {query.isPending ? "…" : label === "Записи" ? number(value) : money(value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function PromotionOperations() {
  const { currentClinic } = useClinic();
  const query = useQuery({
    queryKey: ["s8-clinic-promotions", currentClinic?.id],
    queryFn: async () => {
      const result = await supabase
        .from("promotions")
        .select("id, title, description, discount, active, valid_until")
        .eq("clinic_id", currentClinic!.id)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return (result.data ?? []) as JsonRow[];
    },
    enabled: Boolean(currentClinic?.id),
  });

  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title="Акции"
        description="Акции, опубликованные выбранной клиникой."
        action={{ href: "/promotions", label: "Посмотреть как пациент" }}
      />
      {query.isError ? (
        <ErrorState message="Не удалось загрузить акции." onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Empty>Загружаем акции…</Empty>
      ) : !query.data?.length ? (
        <Empty>У клиники пока нет акций.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {query.data.map((row) => (
            <Card key={text(row.id)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span>{text(row.title, "Акция")}</span>
                  <Badge variant={row.active === false ? "secondary" : "default"}>
                    {row.active === false ? "Выключена" : `−${number(row.discount)}%`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {text(row.description, "Описание не указано")}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function MaterialsOperations() {
  const { currentClinic } = useClinic();
  const query = useQuery({
    queryKey: ["s8-assistant-materials", currentClinic?.id],
    queryFn: async () => {
      const [stats, items] = await Promise.all([sklad.stats(), sklad.listItems({ low: "true" })]);
      return { stats, items };
    },
    enabled: Boolean(currentClinic?.id),
  });
  return (
    <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <StaffPageHeader
        title="Материалы"
        description="Остатки и позиции, которые пора пополнить."
        action={{ href: "/sklad", label: "Открыть склад" }}
      />
      {query.isError ? (
        <ErrorState message="Склад недоступен для текущей роли или клиника не выбрана." onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Всего позиций", query.data?.stats.total_items],
              ["Мало на складе", query.data?.stats.low_stock],
              ["Скоро истекает", query.data?.stats.expiring],
              ["Стоимость", query.data?.stats.total_value],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <Package className="h-5 w-5 text-primary" />
                  <div className="mt-2 text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-xl font-bold">{query.isPending ? "…" : number(value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          {query.data?.items.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {query.data.items.slice(0, 12).map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.location || "Место не указано"}</div>
                    </div>
                    <Badge variant="destructive">{item.quantity} {item.unit || "шт."}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !query.isPending ? <Empty>Низких остатков нет.</Empty> : null}
        </>
      )}
    </div>
  );
}
