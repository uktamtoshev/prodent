import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GitMerge, Search, UserPlus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { AddNewPatientDialog } from "@/components/crm/AddNewPatientDialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  clearPersistentClientRequestId,
  getPersistentClientRequestId,
  listDuplicatePatients,
  mergeDuplicatePatients,
  searchClinicPatients,
} from "@/lib/crm-operations-api";

interface PatientRow {
  id: string;
  patient_type: "registered" | "guest";
  name: string;
  phone?: string | null;
}

interface GuestRow {
  id: string;
  name: string;
  phone?: string | null;
}

interface DuplicateGroup {
  phone_normalized: string;
  duplicate_count: number;
  guests: GuestRow[];
}

export default function Patients() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingMerge, setPendingMerge] = useState<DuplicateGroup | null>(null);
  /**
   * Срез списка. Из эталонных вкладок (Все / Мои / С долгом / Давно не были /
   * Новые) поддержаны только те, что опираются на реально приходящие поля:
   * поиск возвращает id, тип, имя и телефон — ни долга, ни даты последнего
   * визита, ни даты создания в ответе нет. Остальные вкладки будут ложью:
   * они показали бы пустой список независимо от данных.
   */
  const [patientTab, setPatientTab] = useState<"all" | "registered" | "guest">("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [input]);

  const patients = useQuery({
    queryKey: ["s7-clinic-patients", currentClinic?.id, search],
    queryFn: () =>
      searchClinicPatients(currentClinic!.id, search) as Promise<PatientRow[]>,
    enabled: !!currentClinic?.id && search.trim().length >= 2,
  });
  const duplicates = useQuery({
    queryKey: ["s7-patient-duplicates", currentClinic?.id],
    queryFn: () =>
      listDuplicatePatients(currentClinic!.id) as Promise<DuplicateGroup[]>,
    enabled: !!currentClinic?.id,
  });

  const merge = useMutation({
    mutationFn: async (group: DuplicateGroup) => {
      const [survivor, ...others] = group.guests;
      const actionKey = `patient-merge:${group.phone_normalized}:${group.guests
        .map((guest) => guest.id)
        .sort()
        .join(",")}`;
      const clientRequestId = getPersistentClientRequestId(
        user?.id ?? "anonymous",
        currentClinic!.id,
        actionKey,
      );
      const result = await mergeDuplicatePatients(currentClinic!.id, {
        clientRequestId,
        survivorGuestId: survivor.id,
        duplicateGuestIds: others.map((guest) => guest.id),
      });
      clearPersistentClientRequestId(
        user?.id ?? "anonymous",
        currentClinic!.id,
        actionKey,
      );
      return result;
    },
    onSuccess: () => {
      toast.success(t("crmPatientSearch.duplicatesMerged"));
      void queryClient.invalidateQueries({ queryKey: ["s7-patient-duplicates"] });
      void queryClient.invalidateQueries({ queryKey: ["s7-clinic-patients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <CRMLayout>
      <div className="max-w-full space-y-section overflow-x-clip p-4 pb-24 md:p-6 lg:p-8">
        {/* A decorative gradient card used to sit here holding a title and a
            counter. The section name now lives in the cabinet top bar, so this
            row spends its height on the thing that was missing entirely: a way
            to create a patient. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Показатель «Найдено». Четыре эталонных («Всего пациентов»,
              «Новые за месяц», «Давно не были», «Общий долг») построить не из
              чего: поиск возвращает id, тип, имя и телефон — ни даты создания,
              ни последнего визита, ни долга в ответе нет. */}
          <div>
            <p className="text-meta font-medium text-muted-foreground">
              {t("crmPatientSearch.subtitle")}
            </p>
            <p className="text-kpi tabular-nums font-heading">{patients.data?.length ?? 0}</p>
          </div>
          <Button onClick={() => setAddPatientOpen(true)} disabled={!currentClinic?.id}>
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            {t("crmAddNewPatient.newPatient")}
          </Button>
        </div>

        {/* Срезы и счётчик найденных. Опираются на поля, которые реально
            приходят в ответе поиска. */}
        {patients.data && patients.data.length > 0 && (
          <div className="flex flex-wrap items-center gap-0.5">
            {([
              { key: "all" as const, label: t("crmPatientSearch.tabAll"), n: patients.data.length },
              { key: "registered" as const, label: t("crmPatientSearch.registered"), n: patients.data.filter((x) => x.patient_type === "registered").length },
              { key: "guest" as const, label: t("crmPatientSearch.guest"), n: patients.data.filter((x) => x.patient_type === "guest").length },
            ]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPatientTab(item.key)}
                aria-pressed={patientTab === item.key}
                className={cn(
                  "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  patientTab === item.key
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.n > 0 && (
                  <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                    {item.n}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="relative max-w-xl">
          <Search aria-hidden="true" className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="crm-patient-search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("crmPatients.searchPlaceholder")}
            aria-label={t("crmPatients.searchPlaceholder")}
            className="min-h-11 max-w-full pl-9"
          />
        </div>

        {duplicates.isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground" role="status">
              {t("common.loading")}
            </CardContent>
          </Card>
        )}

        {duplicates.isError && (
          <Card className="border-destructive/30">
            <CardContent className="py-8 text-center" role="alert">
              <p>{t("crmPatientSearch.loadError")}</p>
              <Button className="mt-3 min-h-11" variant="outline" onClick={() => void duplicates.refetch()}>
                {t("crmPatientSearch.retry")}
              </Button>
            </CardContent>
          </Card>
        )}

        {duplicates.data && duplicates.data.length > 0 && (
          <Card className="border-warning-amber/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <GitMerge aria-hidden="true" className="h-5 w-5 text-warning-amber" />
                {t("crmPatientSearch.possibleDuplicates")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicates.data.map((group) => (
                <div
                  key={group.phone_normalized}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{group.guests.map((guest) => guest.name).join(" · ")}</p>
                    <p className="text-sm text-muted-foreground">{group.guests[0]?.phone || "—"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    disabled={merge.isPending || group.guests.length < 2}
                    aria-busy={merge.isPending}
                    onClick={() => setPendingMerge(group)}
                  >
                    <GitMerge aria-hidden="true" className="mr-2 h-4 w-4" />
                    {t("crmPatientSearch.merge")}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {search.trim().length < 2 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <Search aria-hidden="true" className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">{t("crmPatientSearch.minSearchLength")}</p>
              {/* An empty state with no action is a dead end: the administrator
                  who could not find a patient had nowhere to go from here and
                  ended up creating them as a "guest" from the schedule instead,
                  retyping the name and phone. */}
              <Button variant="outline" onClick={() => setAddPatientOpen(true)} disabled={!currentClinic?.id}>
                <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                {t("crmAddNewPatient.newPatient")}
              </Button>
            </CardContent>
          </Card>
        ) : patients.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t("common.loading")}>
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
          </div>
        ) : patients.isError ? (
          <Card className="border-destructive/30">
            <CardContent className="py-10 text-center">
              <p>{t("crmPatientSearch.loadError")}</p>
              <Button className="mt-3 min-h-11" variant="outline" onClick={() => void patients.refetch()}>
                {t("crmPatientSearch.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : patients.data?.length ? (
          // Список пациентов — таблица, как в макете. Сетка карточек давала три
          // пациента в ряд и разную высоту строк: сравнивать телефоны и типы
          // глазом было нечем. Таблица держит колонки на месте, плотность
          // строки (42px) приходит из примитива. data-testid и data-patient-id
          // сохранены: по ним ищут тесты.
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crmPatientSearch.nameColumn")}</TableHead>
                    <TableHead>{t("crmPatientSearch.phoneColumn")}</TableHead>
                    <TableHead className="text-right">{t("crmPatientSearch.typeColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.data.filter((patient) => patientTab === "all" || patient.patient_type === patientTab).map((patient) => (
                    <TableRow
                      key={`${patient.patient_type}:${patient.id}`}
                      data-testid="crm-patient-result"
                      data-patient-id={patient.id}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10">
                            <UserRound className="h-4 w-4 text-primary" />
                          </div>
                          {patient.patient_type === "registered" ? (
                            <Link
                              className="min-h-11 inline-flex items-center rounded-md font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              to={`/crm/patients/${patient.id}`}
                            >
                              {patient.name || "—"}
                            </Link>
                          ) : (
                            <span className="font-medium">{patient.name || "—"}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {patient.phone || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={patient.patient_type === "guest" ? "muted" : "info"}>
                          {patient.patient_type === "guest"
                            ? t("crmPatientSearch.guest")
                            : t("crmPatientSearch.registered")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center text-muted-foreground">
              <UserRound className="mx-auto mb-3 h-10 w-10" />
              {t("crmPatientSearch.notFound")}
            </CardContent>
          </Card>
        )}

        <AlertDialog
          open={!!pendingMerge}
          onOpenChange={(open) => {
            if (!open && !merge.isPending) setPendingMerge(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("crmPatientSearch.possibleDuplicates")}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingMerge
                  ? `${pendingMerge.guests.map((guest) => guest.name).join(" · ")} — ${
                      pendingMerge.guests[0]?.phone || "—"
                    }`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11" disabled={merge.isPending}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11"
                disabled={!pendingMerge || merge.isPending}
                onClick={() => {
                  if (!pendingMerge) return;
                  merge.mutate(pendingMerge);
                  setPendingMerge(null);
                }}
              >
                {t("crmPatientSearch.merge")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AddNewPatientDialog
          open={addPatientOpen}
          onOpenChange={(open) => {
            setAddPatientOpen(open);
            if (!open) void patients.refetch();
          }}
        />
      </div>
    </CRMLayout>
  );
}
