import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { AlertCircle, CheckCircle, ChevronDown, Clock, FileHeart, History, Loader2, Plus, RefreshCw, Shield, User as UserIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getReasonLabel, useDoctorAccessRequests, useExtendAccess } from "@/hooks/useMedicalAccess";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

type AccessRow = {
  id: string;
  patient_id: string;
  reason: string;
  source: string;
  status: "pending" | "active" | "expired" | "revoked";
  valid_from: string;
  valid_to: string;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
};

const DURATION_OPTIONS = [
  { hours: 1, key: "hour1", fallback: "1 час" },
  { hours: 6, key: "hours6", fallback: "6 часов" },
  { hours: 24, key: "hours24", fallback: "24 часа" },
  { hours: 72, key: "days3", fallback: "3 дня" },
  { hours: 168, key: "days7", fallback: "7 дней" },
];

const safeLabel = (value: string, fallback: string) =>
  value && !/[ÐÑÂâ]/.test(value) ? value : fallback;

function StatusBadge({ row }: { row: AccessRow }) {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);

  if (row.status === "active") {
    const expiresIn = formatDistanceToNow(new Date(row.valid_to), { locale: ru, addSuffix: true });
    return (
      <Badge className="gap-1 border-status-success/20 bg-status-success/10 text-status-success">
        <Clock className="h-3 w-3" />
        {tr("medicalAccess.expiresIn", "Истекает")} {expiresIn}
      </Badge>
    );
  }
  if (row.status === "pending") {
    return <Badge className="border-status-warning/20 bg-status-warning/10 text-status-warning">{tr("medicalAccess.pendingDecision", "Ожидает решения")}</Badge>;
  }
  if (row.status === "expired") return <Badge variant="secondary">{tr("medicalAccess.expired", "Истёк")}</Badge>;
  return <Badge variant="destructive">{tr("medicalAccess.revoked", "Отозван")}</Badge>;
}

function EmptyAccessState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-muted-foreground">
        <Shield className="mx-auto mb-3 h-10 w-10 opacity-50" />
        {text}
      </CardContent>
    </Card>
  );
}

function ErrorAccessState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-10 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{text}</p>
        <Button type="button" variant="outline" className="mt-4 gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Попробовать снова
        </Button>
      </CardContent>
    </Card>
  );
}

function AccessRowCard({ row }: { row: AccessRow }) {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const navigate = useNavigate();
  const extendAccess = useExtendAccess();
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendHours, setExtendHours] = useState(24);

  const isActive = row.status === "active";
  const patientName = row.profiles?.full_name || tr("medicalAccess.unknown", "Неизвестный пациент");
  const initials = patientName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  const selectedDuration = DURATION_OPTIONS.find((option) => option.hours === extendHours) || DURATION_OPTIONS[2];

  return (
    <>
      <Card className="border-border/60 transition-shadow hover:shadow-soft">
        <CardContent className="flex flex-col gap-3 px-card-x py-3 sm:flex-row sm:items-start">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={row.profiles?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {row.profiles?.avatar_url ? initials : <UserIcon className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-cell font-semibold">{patientName}</h4>
              {row.profiles?.phone && <span className="text-xs tabular-nums text-muted-foreground">• {row.profiles.phone}</span>}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge row={row} />
              <span className="text-xs text-muted-foreground">{getReasonLabel(row.reason)}</span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {tr("medicalAccess.requestFrom", "Запрос от")} {format(new Date(row.created_at), "d MMMM, HH:mm", { locale: ru })}
            </p>
            {isActive && (
              <p className="text-xs text-muted-foreground">
                {tr("medicalAccess.accessUntil", "Доступ до")} {format(new Date(row.valid_to), "d MMMM, HH:mm", { locale: ru })}
              </p>
            )}
          </div>

          {isActive && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate(`/crm/medical/${row.patient_id}`)}>
                <FileHeart className="h-4 w-4" />
                {tr("medicalAccess.openRecord", "Открыть карту")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setExtendOpen(true)}>
                <Plus className="h-4 w-4" />
                {tr("medicalAccess.extendBtn", "Продлить")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={extendOpen} onOpenChange={setExtendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("medicalAccess.extendAccessTitle", "Продлить доступ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("medicalAccess.extendAccessDesc", "Продлить доступ для {name}").replace("{name}", patientName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />+ {tr(`medicalAccess.${selectedDuration.key}`, selectedDuration.fallback)}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                {DURATION_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.hours} onClick={() => setExtendHours(option.hours)}>
                    + {tr(`medicalAccess.${option.key}`, option.fallback)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("common.cancel", "Отмена")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={extendAccess.isPending}
              onClick={() => {
                extendAccess.mutate({ requestId: row.id, additionalHours: extendHours });
                setExtendOpen(false);
              }}
            >
              {extendAccess.isPending ? tr("common.saving", "Сохранение...") : tr("medicalAccess.extendBtn", "Продлить")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function DoctorMedicalAccess() {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const { user } = useAuth();

  const {
    data: doctorRow,
    isLoading: doctorLoading,
    isError: doctorError,
    refetch: refetchDoctor,
  } = useQuery({
    queryKey: ["current-doctor-row", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    enabled: !!user?.id,
  });

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch: refetchAccessRequests,
  } = useDoctorAccessRequests(doctorRow?.id);

  const now = Date.now();
  const normalized: AccessRow[] = useMemo(
    () =>
      (rows as AccessRow[]).map((row) =>
        row.status === "active" && new Date(row.valid_to).getTime() < now ? { ...row, status: "expired" } : row
      ),
    [rows, now]
  );

  const pending = normalized.filter((row) => row.status === "pending");
  const active = normalized.filter((row) => row.status === "active");
  const history = normalized.filter((row) => row.status === "expired" || row.status === "revoked");
  const pageLoading = doctorLoading || isLoading;
  const pageError = doctorError || isError;
  const retryAccess = () => {
    void refetchDoctor();
    if (doctorRow?.id) void refetchAccessRequests();
  };

  const renderRows = (items: AccessRow[], emptyText: string) => {
    if (pageLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (pageError) {
      return (
        <ErrorAccessState
          text="Не удалось загрузить доступы. Проверьте интернет и попробуйте снова."
          onRetry={retryAccess}
        />
      );
    }
    if (!doctorRow) return <EmptyAccessState text="Для текущего пользователя не найден профиль врача." />;
    if (items.length === 0) return <EmptyAccessState text={emptyText} />;
    return items.map((row) => <AccessRowCard key={row.id} row={row} />);
  };

  return (
    <CRMLayout>
      <PermissionGate module="patients">
        <div className="space-y-section p-4 lg:p-6">
          {/* Заголовок без градиентной иконки — по макету у экрана нет
              декоративной плашки, а сама иконка ничего не сообщала сверх
              названия раздела. */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
                {tr("doctorMedicalAccess.title", "Доступы к медкартам")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {tr("doctorMedicalAccess.description", "Запросы доступа, активные допуски и история")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-section sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-status-warning/20 bg-status-warning/5">
              <CardContent className="flex items-center gap-3 py-4">
                <Clock className="h-5 w-5 text-status-warning" />
                <div>
                  <p className="text-kpi tabular-nums font-heading">{pending.length}</p>
                  <p className="text-sm text-muted-foreground">{tr("doctorMedicalAccess.statPending", "Ожидают согласия")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-status-success/20 bg-status-success/5">
              <CardContent className="flex items-center gap-3 py-4">
                <CheckCircle className="h-5 w-5 text-status-success" />
                <div>
                  <p className="text-kpi tabular-nums font-heading">{active.length}</p>
                  <p className="text-sm text-muted-foreground">{tr("doctorMedicalAccess.statActive", "Активные доступы")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-kpi tabular-nums font-heading">{history.length}</p>
                  <p className="text-sm text-muted-foreground">{tr("doctorMedicalAccess.statHistory", "В истории")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                {tr("patientCabinet.tabPending", "Ожидающие")}
                {pending.length > 0 && <Badge variant="secondary" className="ml-1 tabular-nums">{pending.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                {tr("patientCabinet.tabActive", "Активные")}
                {active.length > 0 && <Badge className="ml-1 border-status-success/20 bg-status-success/10 text-status-success tabular-nums">{active.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                {tr("patientCabinet.tabHistory", "История")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {renderRows(pending, tr("doctorMedicalAccess.noPending", "Нет ожидающих запросов"))}
            </TabsContent>
            <TabsContent value="active" className="space-y-3">
              {renderRows(active, tr("doctorMedicalAccess.noActive", "Нет активных доступов"))}
            </TabsContent>
            <TabsContent value="history" className="space-y-3">
              {renderRows(history, tr("doctorMedicalAccess.noHistory", "История пуста"))}
            </TabsContent>
          </Tabs>
        </div>
      </PermissionGate>
    </CRMLayout>
  );
}
