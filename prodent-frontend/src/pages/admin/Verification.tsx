import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { submitVerificationDecision } from "@/lib/adminVerification";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  ExternalLink,
  Pencil,
  Search,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DoctorApplication } from "@/components/admin/EditDoctorApplicationDialog";
import type { ClinicApplication } from "@/components/admin/EditClinicApplicationDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const EditDoctorApplicationDialog = lazy(() =>
  import("@/components/admin/EditDoctorApplicationDialog").then((module) => ({
    default: module.EditDoctorApplicationDialog,
  }))
);

const EditClinicApplicationDialog = lazy(() =>
  import("@/components/admin/EditClinicApplicationDialog").then((module) => ({
    default: module.EditClinicApplicationDialog,
  }))
);

const editDialogFallback = (
  <div
    className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm"
    role="status"
    aria-live="polite"
    aria-label="Загрузка окна редактирования"
  />
);

// Status filter values used by the chip row (case-insensitive against DB).
type StatusFilter = "pending" | "approved" | "rejected" | "all";

interface ApplicationLike {
  status: string;
  created_at?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  license_number?: string | null;
  review_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

const verificationError = (error: unknown) => error instanceof Error ? error.message : String(error);
const reviewReasonOf = (app: ApplicationLike & { rejection_reason?: string | null }) =>
  app.review_reason || app.rejection_reason || null;

// --- small presentational helpers (all local to this file) ------------------

// Inline document preview: opens license/diploma/registration in a Dialog.
// Images render in an <img>, everything else (e.g. PDF) in an <iframe>.
// Missing/empty url => disabled "Документ не приложен" button.
function DocumentPreview({ label, url }: { label: string; url?: string | null }) {
  const has = !!url && String(url).trim().length > 0;

  if (!has) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="min-h-11 flex-1 justify-center"
        disabled
        title="Документ не приложен"
      >
        <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
        Документ не приложен
      </Button>
    );
  }

  const clean = String(url).split("?")[0].toLowerCase();
  const isImage =
    /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(clean) || !/\.[a-z0-9]{2,5}$/.test(clean);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="min-h-11 flex-1 justify-center">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto rounded-md border border-border bg-muted/30">
          {isImage ? (
            <img src={url!} alt={label} className="mx-auto max-h-[70vh] w-auto object-contain" />
          ) : (
            <iframe src={url!} title={label} className="w-full h-[70vh]" />
          )}
        </div>
        <div className="flex justify-end">
          <a
            href={url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Открыть в новой вкладке
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Audit-trail line for already-decided (non-pending) cards.
function AuditLine({
  status,
  reviewedAt,
  reviewerId,
  reason,
}: {
  status: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
  reason?: string | null;
}) {
  const s = String(status).toLowerCase();
  if (s !== "approved" && s !== "rejected") return null;
  const verb = s === "approved" ? "Одобрено" : "Отклонено";
  let when = "";
  if (reviewedAt) {
    const d = new Date(reviewedAt);
    if (!isNaN(d.getTime())) when = ` · ${d.toLocaleDateString("ru-RU")}`;
  }
  return (
    <div className="min-w-0 space-y-0.5 break-words text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {verb}
        {when}
      </p>
      {reviewerId && <p>Проверил: {reviewerId}</p>}
      {reason && <p>Причина: {reason}</p>}
    </div>
  );
}

// Confirm-before-approve wrapper. Only "Confirm" calls onConfirm().
function ApproveConfirm({
  kind,
  disabled,
  onConfirm,
  label,
}: {
  kind: "doctor" | "clinic" | "technician" | "supplier";
  disabled?: boolean;
  onConfirm: () => void;
  label: string;
}) {
  const title =
    kind === "doctor"
      ? "Одобрить заявку врача?"
      : kind === "clinic"
        ? "Одобрить заявку клиники?"
        : kind === "supplier"
          ? "Одобрить заявку поставщика?"
          : "Одобрить заявку зуботехника?";
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} className="min-h-11 flex-1">
          <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Это выдаст доступ к кабинету.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Одобрить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// KPI overview cards computed from a list of applications.
function KpiCards<T extends ApplicationLike>({ apps }: { apps: T[] }) {
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const a of apps) {
      c.total += 1;
      const s = String(a.status).toLowerCase();
      if (s === "pending") c.pending += 1;
      else if (s === "approved") c.approved += 1;
      else if (s === "rejected") c.rejected += 1;
    }
    return c;
  }, [apps]);

  const items: { label: string; value: number; tone: string }[] = [
    { label: "Ожидают", value: counts.pending, tone: "text-warning-amber" },
    { label: "Одобрено", value: counts.approved, tone: "text-[hsl(var(--success-green))]" },
    { label: "Отклонено", value: counts.rejected, tone: "text-destructive" },
    { label: "Всего", value: counts.total, tone: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <p className={`mt-1 text-2xl font-bold ${it.tone}`}>{it.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Segmented chip row. Defaults to "pending" (set by the page state).
function StatusChips({
  apps,
  value,
  onChange,
}: {
  apps: ApplicationLike[];
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const count = (status: StatusFilter) =>
    status === "all"
      ? apps.length
      : apps.filter((a) => String(a.status).toLowerCase() === status).length;

  const chips: { key: StatusFilter; label: string }[] = [
    { key: "pending", label: "Ожидают" },
    { key: "approved", label: "Одобрены" },
    { key: "rejected", label: "Отклонены" },
    { key: "all", label: "Все" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = value === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            aria-pressed={active}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {chip.label}
            <span
              className={`rounded-full px-1.5 text-xs font-semibold ${
                active ? "bg-primary-foreground/20" : "bg-muted-foreground/10"
              }`}
            >
              {count(chip.key)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Pending-first ordering: pending rows first, then created_at desc within group.
function sortPendingFirst<T extends ApplicationLike>(apps: T[]): T[] {
  const rank = (s: string) => (String(s).toLowerCase() === "pending" ? 0 : 1);
  return [...apps].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
}

// Apply status filter + search, then pending-first sort.
function filterApps<T extends ApplicationLike>(apps: T[], status: StatusFilter, query: string): T[] {
  const q = query.trim().toLowerCase();
  let out = apps;
  if (status !== "all") {
    out = out.filter((a) => String(a.status).toLowerCase() === status);
  }
  if (q) {
    out = out.filter((a) => {
      const haystack = [a.name, a.full_name, a.email, a.phone, a.license_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  return sortPendingFirst(out);
}

// Error card with a retry button (shown instead of the empty state on query error).
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card role="alert">
      <CardContent className="py-12 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="text-muted-foreground">Не удалось загрузить заявки.</p>
        <Button variant="outline" className="min-h-11" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Повторить
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Verification() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [editingDoctor, setEditingDoctor] = useState<DoctorApplication | null>(null);
  const [editingClinic, setEditingClinic] = useState<ClinicApplication | null>(null);

  // Per-tab filter + search state. Default status filter = pending.
  const [doctorStatus, setDoctorStatus] = useState<StatusFilter>("pending");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [clinicStatus, setClinicStatus] = useState<StatusFilter>("pending");
  const [clinicSearch, setClinicSearch] = useState("");
  const [techStatus, setTechStatus] = useState<StatusFilter>("pending");
  const [techSearch, setTechSearch] = useState("");
  const [supStatus, setSupStatus] = useState<StatusFilter>("pending");
  const [supSearch, setSupSearch] = useState("");

  // Clear only the acted-on application's draft reason (fixes the bug where a
  // single success wiped every card's in-progress text).
  const clearReason = (id: string) =>
    setReviewReason((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const {
    data: doctorApplications,
    isLoading: doctorsLoading,
    isError: doctorsError,
    refetch: refetchDoctors,
  } = useQuery({
    queryKey: ["doctor-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const {
    data: clinicApplications,
    isLoading: clinicsLoading,
    isError: clinicsError,
    refetch: refetchClinics,
  } = useQuery({
    queryKey: ["clinic-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const {
    data: technicianApplications,
    isLoading: techsLoading,
    isError: techsError,
    refetch: refetchTechs,
  } = useQuery({
    queryKey: ["technician-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const {
    data: supplierApplications,
    isLoading: supsLoading,
    isError: supsError,
    refetch: refetchSups,
  } = useQuery({
    queryKey: ["supplier-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Notify the applicant of the verification decision by inserting a
  // notifications row (owner = applicant's user_id). Best-effort: a failure to
  // notify must NOT roll back the approval/rejection, so errors are swallowed
  // and logged. The `notifications` table is owner-scoped by user_id and the
  // admin (clinic-staff/admin) bypasses owner-scoping, so it may target the
  // applicant. (SMS is out of scope here — see audit item.)
  const notifyApplicant = async (
    userId: string | null | undefined,
    title: string,
    message: string,
    metadata: Record<string, unknown>
  ) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "internal",
        title,
        message,
        metadata,
      });
      if (error) console.error("Failed to create applicant notification:", error);
    } catch (e) {
      console.error("Failed to create applicant notification:", e);
    }
  };

  const approveDoctorMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = doctorApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");
      await submitVerificationDecision("doctor", applicationId, "approved", reason);

      // Inform the applicant that their doctor profile was approved.
      await notifyApplicant(
        app.user_id,
        t("adminVerification.doctorApproved"),
        "Ваша заявка на верификацию врача одобрена.",
        { application_id: applicationId, kind: "doctor_application", decision: "approved" }
      );
    },
    onSuccess: (_data, { applicationId }) => {
      toast.success(t("adminVerification.doctorApproved"));
      queryClient.invalidateQueries({ queryKey: ["doctor-applications"] });
      clearReason(applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.approveError"), { description: verificationError(error) });
    },
  });

  const rejectDoctorMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = doctorApplications?.find((a) => a.id === applicationId);
      await submitVerificationDecision("doctor", applicationId, "rejected", reason);

      // Inform the applicant that their doctor profile was rejected (+ reason).
      await notifyApplicant(
        app?.user_id,
        t("adminVerification.appRejected"),
        `Ваша заявка на верификацию врача отклонена. Причина: ${reason.trim()}`,
        { application_id: applicationId, kind: "doctor_application", decision: "rejected", reason: reason.trim() }
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(t("adminVerification.appRejected"));
      queryClient.invalidateQueries({ queryKey: ["doctor-applications"] });
      clearReason(variables.applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.rejectError"), { description: verificationError(error) });
    },
  });

  const approveClinicMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = clinicApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");
      await submitVerificationDecision("clinic", applicationId, "approved", reason);

      // Inform the applicant that their clinic was approved.
      await notifyApplicant(
        app.user_id,
        t("adminVerification.clinicApproved"),
        "Ваша заявка на верификацию клиники одобрена.",
        { application_id: applicationId, kind: "clinic_application", decision: "approved" }
      );
    },
    onSuccess: (_data, { applicationId }) => {
      toast.success(t("adminVerification.clinicApproved"));
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
      clearReason(applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.approveError"), { description: verificationError(error) });
    },
  });

  const rejectClinicMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = clinicApplications?.find((a) => a.id === applicationId);
      await submitVerificationDecision("clinic", applicationId, "rejected", reason);

      // Inform the applicant that their clinic was rejected (+ reason).
      await notifyApplicant(
        app?.user_id,
        t("adminVerification.appRejected"),
        `Ваша заявка на верификацию клиники отклонена. Причина: ${reason.trim()}`,
        { application_id: applicationId, kind: "clinic_application", decision: "rejected", reason: reason.trim() }
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(t("adminVerification.appRejected"));
      queryClient.invalidateQueries({ queryKey: ["clinic-applications"] });
      clearReason(variables.applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.rejectError"), { description: verificationError(error) });
    },
  });

  const approveTechnicianMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = technicianApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");
      await submitVerificationDecision("technician", applicationId, "approved", reason);

      await notifyApplicant(
        app.user_id,
        t("adminVerification.techApproved"),
        "Ваша заявка зуботехника одобрена. Кабинет лаборатории доступен.",
        { application_id: applicationId, kind: "technician_application", decision: "approved" }
      );
    },
    onSuccess: (_data, { applicationId }) => {
      toast.success(t("adminVerification.techApproved"));
      queryClient.invalidateQueries({ queryKey: ["technician-applications"] });
      clearReason(applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.approveError"), { description: verificationError(error) });
    },
  });

  const rejectTechnicianMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = technicianApplications?.find((a) => a.id === applicationId);
      await submitVerificationDecision("technician", applicationId, "rejected", reason);

      await notifyApplicant(
        app?.user_id,
        t("adminVerification.appRejected"),
        `Ваша заявка зуботехника отклонена. Причина: ${reason.trim()}`,
        { application_id: applicationId, kind: "technician_application", decision: "rejected", reason: reason.trim() }
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(t("adminVerification.appRejected"));
      queryClient.invalidateQueries({ queryKey: ["technician-applications"] });
      clearReason(variables.applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.rejectError"), { description: verificationError(error) });
    },
  });

  const approveSupplierMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = supplierApplications?.find((a) => a.id === applicationId);
      if (!app) throw new Error("Application not found");
      await submitVerificationDecision("supplier", applicationId, "approved", reason);

      await notifyApplicant(
        app.user_id,
        "Заявка поставщика одобрена",
        "Ваша заявка поставщика одобрена. Кабинет поставщика доступен.",
        { application_id: applicationId, kind: "supplier_application", decision: "approved" }
      );
    },
    onSuccess: (_data, { applicationId }) => {
      toast.success("Заявка поставщика одобрена");
      queryClient.invalidateQueries({ queryKey: ["supplier-applications"] });
      clearReason(applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.approveError"), { description: verificationError(error) });
    },
  });

  const rejectSupplierMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const app = supplierApplications?.find((a) => a.id === applicationId);
      await submitVerificationDecision("supplier", applicationId, "rejected", reason);

      await notifyApplicant(
        app?.user_id,
        t("adminVerification.appRejected"),
        `Ваша заявка поставщика отклонена. Причина: ${reason.trim()}`,
        { application_id: applicationId, kind: "supplier_application", decision: "rejected", reason: reason.trim() }
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(t("adminVerification.appRejected"));
      queryClient.invalidateQueries({ queryKey: ["supplier-applications"] });
      clearReason(variables.applicationId);
    },
    onError: (error: unknown) => {
      toast.error(t("adminVerification.rejectError"), { description: verificationError(error) });
    },
  });

  // Parentheses show the TOTAL number of applications; the "+N" badge shows how
  // many are NEW (still pending review).
  const doctorTotal = doctorApplications?.length ?? 0;
  const doctorNew = doctorApplications?.filter((a) => a.status === "pending").length ?? 0;
  const clinicTotal = clinicApplications?.length ?? 0;
  const clinicNew = clinicApplications?.filter((a) => a.status === "pending").length ?? 0;
  const techTotal = technicianApplications?.length ?? 0;
  const techNew = technicianApplications?.filter((a) => a.status === "pending").length ?? 0;
  const supTotal = supplierApplications?.length ?? 0;
  const supNew = supplierApplications?.filter((a) => a.status === "pending").length ?? 0;

  // Status-filtered + searched + pending-first ordered lists per tab.
  const doctorList = useMemo(
    () => filterApps(doctorApplications ?? [], doctorStatus, doctorSearch),
    [doctorApplications, doctorStatus, doctorSearch]
  );
  const clinicList = useMemo(
    () => filterApps(clinicApplications ?? [], clinicStatus, clinicSearch),
    [clinicApplications, clinicStatus, clinicSearch]
  );
  const techList = useMemo(
    () => filterApps(technicianApplications ?? [], techStatus, techSearch),
    [technicianApplications, techStatus, techSearch]
  );
  const supList = useMemo(
    () => filterApps(supplierApplications ?? [], supStatus, supSearch),
    [supplierApplications, supStatus, supSearch]
  );

  const getStatusBadge = (status: string) => {
    switch (String(status).toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="border-warning-amber/30 bg-warning-amber/10 text-warning-amber">{t("adminVerification.statusPending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="border-[hsl(var(--success-green)/0.3)] bg-[hsl(var(--success-green)/0.1)] text-[hsl(var(--success-green))]">{t("adminVerification.statusApproved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">{t("adminVerification.statusRejected")}</Badge>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("adminVerification.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("adminVerification.subtitle")}
          </p>
        </div>

        <Tabs defaultValue="doctors" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto" aria-label="Тип заявок">
            <TabsTrigger value="doctors" className="min-h-11 gap-1.5">
              {t("adminVerification.tabDoctors")} ({doctorTotal})
              {doctorNew > 0 && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-green)/0.15)] px-1.5 text-xs font-semibold text-[hsl(var(--success-green))]">
                  +{doctorNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="clinics" className="min-h-11 gap-1.5">
              {t("adminVerification.tabClinics")} ({clinicTotal})
              {clinicNew > 0 && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-green)/0.15)] px-1.5 text-xs font-semibold text-[hsl(var(--success-green))]">
                  +{clinicNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="technicians" className="min-h-11 gap-1.5">
              {t("adminVerification.tabTechnicians")} ({techTotal})
              {techNew > 0 && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-green)/0.15)] px-1.5 text-xs font-semibold text-[hsl(var(--success-green))]">
                  +{techNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="min-h-11 gap-1.5">
              Поставщики ({supTotal})
              {supNew > 0 && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--success-green)/0.15)] px-1.5 text-xs font-semibold text-[hsl(var(--success-green))]">
                  +{supNew}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctors" className="space-y-4">
            <KpiCards apps={doctorApplications ?? []} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusChips apps={doctorApplications ?? []} value={doctorStatus} onChange={setDoctorStatus} />
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Поиск по имени, email, телефону, лицензии"
                  aria-label="Поиск заявок врачей"
                  className="pl-9"
                />
              </div>
            </div>

            {doctorsLoading ? (
              <div className="flex justify-center py-12" role="status" aria-label="Загрузка заявок врачей">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : doctorsError ? (
              <ErrorState onRetry={() => refetchDoctors()} />
            ) : doctorList.length > 0 ? (
              doctorList.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-xl">{app.full_name}</CardTitle>
                        <CardDescription>{app.specialty} • {app.experience_years} {t("adminVerification.yearsExp")}</CardDescription>
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {getStatusBadge(app.status)}
                        <AuditLine
                          status={app.status}
                          reviewedAt={app.reviewed_at}
                          reviewerId={app.reviewed_by}
                          reason={reviewReasonOf(app)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList className="grid h-auto min-h-12 w-full grid-cols-1 sm:grid-cols-3" aria-label="Раздел заявки врача">
                        <TabsTrigger value="info" className="min-h-11">Информация</TabsTrigger>
                        <TabsTrigger value="docs" className="min-h-11">Документы</TabsTrigger>
                        <TabsTrigger value="decision" className="min-h-11">Решение</TabsTrigger>
                      </TabsList>

                      <TabsContent value="info" className="space-y-4 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          {app.email && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelEmail")}</p>
                              <p className="font-medium">{app.email}</p>
                            </div>
                          )}
                          {app.phone && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelPhone")}</p>
                              <p className="font-medium">{app.phone}</p>
                            </div>
                          )}
                          {app.license_number && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelLicense")}</p>
                              <p className="font-medium">{app.license_number}</p>
                            </div>
                          )}
                          {app.education && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelEducation")}</p>
                              <p className="font-medium">{app.education}</p>
                            </div>
                          )}
                        </div>

                        {app.bio && (
                          <div>
                            <p className="text-muted-foreground text-sm">{t("adminVerification.labelBio")}</p>
                            <p className="text-sm mt-1">{app.bio}</p>
                          </div>
                        )}

                        {app.certifications && app.certifications.length > 0 && (
                          <div>
                            <p className="text-muted-foreground text-sm">{t("adminVerification.labelCerts")}</p>
                            <ul className="list-disc list-inside text-sm mt-1">
                              {app.certifications.map((cert, idx) => (
                                <li key={idx}>{cert}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="docs" className="pt-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <DocumentPreview label={t("adminVerification.btnLicense")} url={app.license_document_url} />
                          <DocumentPreview label={t("adminVerification.btnDiploma")} url={app.diploma_document_url} />
                        </div>
                      </TabsContent>

                      <TabsContent value="decision" className="pt-3">
                        {String(app.status).toLowerCase() === "pending" ? (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                variant="outline"
                                className="min-h-11 flex-1"
                                onClick={() => setEditingDoctor(app)}
                              >
                                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnEdit")}
                              </Button>
                              <ApproveConfirm
                                kind="doctor"
                                disabled={approveDoctorMutation.isPending || !reviewReason[app.id]?.trim()}
                                onConfirm={() => approveDoctorMutation.mutate({
                                  applicationId: app.id,
                                  reason: reviewReason[app.id] || "",
                                })}
                                label={t("adminVerification.btnApprove")}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`reason-${app.id}`}>Причина решения</Label>
                              <Textarea
                                id={`reason-${app.id}`}
                                placeholder={t("adminVerification.placeholderRejectReason")}
                                value={reviewReason[app.id] || ""}
                                onChange={(e) => setReviewReason({ ...reviewReason, [app.id]: e.target.value })}
                              />
                              <Button
                                variant="destructive"
                                onClick={() => rejectDoctorMutation.mutate({ applicationId: app.id, reason: reviewReason[app.id] || "" })}
                                disabled={rejectDoctorMutation.isPending || !reviewReason[app.id]?.trim()}
                                className="w-full"
                              >
                                <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnReject")}
                              </Button>
                            </div>
                          </div>
                        ) : String(app.status).toLowerCase() === "rejected" && app.rejection_reason ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive">{t("adminVerification.rejectionReasonLabel")}</p>
                            <p className="text-sm mt-1">{app.rejection_reason}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {String(app.status).toLowerCase() === "approved"
                              ? "Заявка одобрена — решение принято."
                              : "Решение не требуется."}
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card role="status">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {doctorSearch.trim() ? "Ничего не найдено" : t("adminVerification.noDoctorApps")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="clinics" className="space-y-4">
            <KpiCards apps={clinicApplications ?? []} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusChips apps={clinicApplications ?? []} value={clinicStatus} onChange={setClinicStatus} />
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={clinicSearch}
                  onChange={(e) => setClinicSearch(e.target.value)}
                  placeholder="Поиск по названию, email, телефону, лицензии"
                  aria-label="Поиск заявок клиник"
                  className="pl-9"
                />
              </div>
            </div>

            {clinicsLoading ? (
              <div className="flex justify-center py-12" role="status" aria-label="Загрузка заявок клиник">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : clinicsError ? (
              <ErrorState onRetry={() => refetchClinics()} />
            ) : clinicList.length > 0 ? (
              clinicList.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {app.logo_url ? (
                          <img
                            src={app.logo_url}
                            alt={app.name}
                            className="h-14 w-14 rounded-lg object-cover border border-border shrink-0 bg-muted"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
                            {app.name?.charAt(0) ?? "?"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-xl truncate">{app.name}</CardTitle>
                          <CardDescription>{app.city}, {app.district}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {getStatusBadge(app.status)}
                        <AuditLine
                          status={app.status}
                          reviewedAt={app.reviewed_at}
                          reviewerId={app.reviewed_by}
                          reason={reviewReasonOf(app)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList className="grid h-auto min-h-12 w-full grid-cols-1 sm:grid-cols-3" aria-label="Раздел заявки клиники">
                        <TabsTrigger value="info" className="min-h-11">Информация</TabsTrigger>
                        <TabsTrigger value="docs" className="min-h-11">Документы</TabsTrigger>
                        <TabsTrigger value="decision" className="min-h-11">Решение</TabsTrigger>
                      </TabsList>

                      <TabsContent value="info" className="space-y-4 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          {app.email && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelEmail")}</p>
                              <p className="font-medium">{app.email}</p>
                            </div>
                          )}
                          {app.phone && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelPhone")}</p>
                              <p className="font-medium">{app.phone}</p>
                            </div>
                          )}
                          {app.director_name && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelDirector")}</p>
                              <p className="font-medium">{app.director_name}</p>
                            </div>
                          )}
                          {app.license_number && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelLicense")}</p>
                              <p className="font-medium">{app.license_number}</p>
                            </div>
                          )}
                          {app.address && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelAddress")}</p>
                              <p className="font-medium">{app.address}</p>
                            </div>
                          )}
                        </div>

                        {app.description && (
                          <div>
                            <p className="text-muted-foreground text-sm">{t("adminVerification.labelDescription")}</p>
                            <p className="text-sm mt-1">{app.description}</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="docs" className="pt-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <DocumentPreview label={t("adminVerification.btnLicense")} url={app.license_document_url} />
                          <DocumentPreview label={t("adminVerification.btnRegistration")} url={app.registration_document_url} />
                        </div>
                      </TabsContent>

                      <TabsContent value="decision" className="pt-3">
                        {String(app.status).toLowerCase() === "pending" ? (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                variant="outline"
                                className="min-h-11 flex-1"
                                onClick={() => setEditingClinic(app)}
                              >
                                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnEdit")}
                              </Button>
                              <ApproveConfirm
                                kind="clinic"
                                disabled={approveClinicMutation.isPending || !reviewReason[app.id]?.trim()}
                                onConfirm={() => approveClinicMutation.mutate({
                                  applicationId: app.id,
                                  reason: reviewReason[app.id] || "",
                                })}
                                label={t("adminVerification.btnApprove")}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`reason-${app.id}`}>Причина решения</Label>
                              <Textarea
                                id={`reason-${app.id}`}
                                placeholder={t("adminVerification.placeholderRejectReason")}
                                value={reviewReason[app.id] || ""}
                                onChange={(e) => setReviewReason({ ...reviewReason, [app.id]: e.target.value })}
                              />
                              <Button
                                variant="destructive"
                                onClick={() => rejectClinicMutation.mutate({ applicationId: app.id, reason: reviewReason[app.id] || "" })}
                                disabled={rejectClinicMutation.isPending || !reviewReason[app.id]?.trim()}
                                className="w-full"
                              >
                                <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnReject")}
                              </Button>
                            </div>
                          </div>
                        ) : String(app.status).toLowerCase() === "rejected" && app.rejection_reason ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive">{t("adminVerification.rejectionReasonLabel")}</p>
                            <p className="text-sm mt-1">{app.rejection_reason}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {String(app.status).toLowerCase() === "approved"
                              ? "Заявка одобрена — решение принято."
                              : "Решение не требуется."}
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card role="status">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {clinicSearch.trim() ? "Ничего не найдено" : t("adminVerification.noClinicApps")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="technicians" className="space-y-4">
            <KpiCards apps={technicianApplications ?? []} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusChips apps={technicianApplications ?? []} value={techStatus} onChange={setTechStatus} />
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  placeholder="Поиск по имени, лаборатории, городу"
                  aria-label="Поиск заявок зуботехников"
                  className="pl-9"
                />
              </div>
            </div>

            {techsLoading ? (
              <div className="flex justify-center py-12" role="status" aria-label="Загрузка заявок зуботехников">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : techsError ? (
              <ErrorState onRetry={() => refetchTechs()} />
            ) : techList.length > 0 ? (
              techList.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-xl">{app.lab_name || app.full_name}</CardTitle>
                        <CardDescription>
                          {app.full_name}
                          {app.city ? ` • ${app.city}` : ""}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {getStatusBadge(app.status)}
                        <AuditLine
                          status={app.status}
                          reviewedAt={app.reviewed_at}
                          reviewerId={app.reviewed_by}
                          reason={reviewReasonOf(app)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList className="grid h-auto min-h-12 w-full grid-cols-1 sm:grid-cols-3" aria-label="Раздел заявки зуботехника">
                        <TabsTrigger value="info" className="min-h-11">Информация</TabsTrigger>
                        <TabsTrigger value="docs" className="min-h-11">Документы</TabsTrigger>
                        <TabsTrigger value="decision" className="min-h-11">Решение</TabsTrigger>
                      </TabsList>

                      <TabsContent value="info" className="space-y-4 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          {app.email && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelEmail")}</p>
                              <p className="font-medium">{app.email}</p>
                            </div>
                          )}
                          {app.phone && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelPhone")}</p>
                              <p className="font-medium">{app.phone}</p>
                            </div>
                          )}
                          {(app.region || app.city) && (
                            <div>
                              <p className="text-muted-foreground">Регион</p>
                              <p className="font-medium">{app.region || app.city}</p>
                            </div>
                          )}
                          {app.district && (
                            <div>
                              <p className="text-muted-foreground">Район</p>
                              <p className="font-medium">{app.district}</p>
                            </div>
                          )}
                          {app.address && (
                            <div>
                              <p className="text-muted-foreground">Адрес</p>
                              <p className="font-medium">{app.address}</p>
                            </div>
                          )}
                          {app.experience_years != null && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelExperience")}</p>
                              <p className="font-medium">{app.experience_years}</p>
                            </div>
                          )}
                        </div>
                        {app.description && (
                          <div>
                            <p className="text-muted-foreground text-sm">{t("adminVerification.labelDescription")}</p>
                            <p className="text-sm mt-1">{app.description}</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="docs" className="pt-3">
                        <DocumentPreview label={t("adminVerification.btnLicense")} url={app.license_document_url} />
                      </TabsContent>

                      <TabsContent value="decision" className="pt-3">
                        {String(app.status).toLowerCase() === "pending" ? (
                          <div className="space-y-3">
                            <ApproveConfirm
                              kind="technician"
                              disabled={approveTechnicianMutation.isPending || !reviewReason[app.id]?.trim()}
                              onConfirm={() => approveTechnicianMutation.mutate({
                                applicationId: app.id,
                                reason: reviewReason[app.id] || "",
                              })}
                              label={t("adminVerification.btnApprove")}
                            />
                            <div className="space-y-2">
                              <Label htmlFor={`reason-${app.id}`}>Причина решения</Label>
                              <Textarea
                                id={`reason-${app.id}`}
                                placeholder={t("adminVerification.placeholderRejectReason")}
                                value={reviewReason[app.id] || ""}
                                onChange={(e) => setReviewReason({ ...reviewReason, [app.id]: e.target.value })}
                              />
                              <Button
                                variant="destructive"
                                onClick={() => rejectTechnicianMutation.mutate({ applicationId: app.id, reason: reviewReason[app.id] || "" })}
                                disabled={rejectTechnicianMutation.isPending || !reviewReason[app.id]?.trim()}
                                className="w-full"
                              >
                                <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnReject")}
                              </Button>
                            </div>
                          </div>
                        ) : String(app.status).toLowerCase() === "rejected" && app.rejection_reason ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive">{t("adminVerification.rejectionReasonLabel")}</p>
                            <p className="text-sm mt-1">{app.rejection_reason}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {String(app.status).toLowerCase() === "approved"
                              ? "Заявка одобрена — решение принято."
                              : "Решение не требуется."}
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card role="status">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {techSearch.trim() ? "Ничего не найдено" : t("adminVerification.noTechApps")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <KpiCards apps={supplierApplications ?? []} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StatusChips apps={supplierApplications ?? []} value={supStatus} onChange={setSupStatus} />
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={supSearch}
                  onChange={(e) => setSupSearch(e.target.value)}
                  placeholder="Поиск по названию, телефону, email"
                  aria-label="Поиск заявок поставщиков"
                  className="pl-9"
                />
              </div>
            </div>

            {supsLoading ? (
              <div className="flex justify-center py-12" role="status" aria-label="Загрузка заявок поставщиков">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : supsError ? (
              <ErrorState onRetry={() => refetchSups()} />
            ) : supList.length > 0 ? (
              supList.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-xl">{app.company_name || app.full_name}</CardTitle>
                        <CardDescription>
                          {app.phone || app.email || "Поставщик"}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {getStatusBadge(app.status)}
                        <AuditLine
                          status={app.status}
                          reviewedAt={app.reviewed_at}
                          reviewerId={app.reviewed_by}
                          reason={reviewReasonOf(app)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList className="grid h-auto min-h-12 w-full grid-cols-1 sm:grid-cols-3" aria-label="Раздел заявки поставщика">
                        <TabsTrigger value="info" className="min-h-11">Информация</TabsTrigger>
                        <TabsTrigger value="docs" className="min-h-11">Документы</TabsTrigger>
                        <TabsTrigger value="decision" className="min-h-11">Решение</TabsTrigger>
                      </TabsList>

                      <TabsContent value="info" className="space-y-4 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          {app.company_name && (
                            <div>
                              <p className="text-muted-foreground">Название фирмы</p>
                              <p className="font-medium">{app.company_name}</p>
                            </div>
                          )}
                          {app.email && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelEmail")}</p>
                              <p className="font-medium">{app.email}</p>
                            </div>
                          )}
                          {app.phone && (
                            <div>
                              <p className="text-muted-foreground">{t("adminVerification.labelPhone")}</p>
                              <p className="font-medium">{app.phone}</p>
                            </div>
                          )}
                          {app.region && (
                            <div>
                              <p className="text-muted-foreground">Регион</p>
                              <p className="font-medium">{app.region}</p>
                            </div>
                          )}
                          {app.district && (
                            <div>
                              <p className="text-muted-foreground">Район</p>
                              <p className="font-medium">{app.district}</p>
                            </div>
                          )}
                          {app.address && (
                            <div>
                              <p className="text-muted-foreground">Адрес</p>
                              <p className="font-medium">{app.address}</p>
                            </div>
                          )}
                        </div>
                        {app.description && (
                          <div>
                            <p className="text-muted-foreground text-sm">{t("adminVerification.labelDescription")}</p>
                            <p className="text-sm mt-1">{app.description}</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="docs" className="pt-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <DocumentPreview label="Гувохнома" url={app.guvohnoma_document_url} />
                          <DocumentPreview label={t("adminVerification.btnLicense")} url={app.license_document_url} />
                        </div>
                      </TabsContent>

                      <TabsContent value="decision" className="pt-3">
                        {String(app.status).toLowerCase() === "pending" ? (
                          <div className="space-y-3">
                            <ApproveConfirm
                              kind="supplier"
                              disabled={approveSupplierMutation.isPending || !reviewReason[app.id]?.trim()}
                              onConfirm={() => approveSupplierMutation.mutate({
                                applicationId: app.id,
                                reason: reviewReason[app.id] || "",
                              })}
                              label={t("adminVerification.btnApprove")}
                            />
                            <div className="space-y-2">
                              <Label htmlFor={`reason-${app.id}`}>Причина решения</Label>
                              <Textarea
                                id={`reason-${app.id}`}
                                placeholder={t("adminVerification.placeholderRejectReason")}
                                value={reviewReason[app.id] || ""}
                                onChange={(e) => setReviewReason({ ...reviewReason, [app.id]: e.target.value })}
                              />
                              <Button
                                variant="destructive"
                                onClick={() => rejectSupplierMutation.mutate({ applicationId: app.id, reason: reviewReason[app.id] || "" })}
                                disabled={rejectSupplierMutation.isPending || !reviewReason[app.id]?.trim()}
                                className="w-full"
                              >
                                <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("adminVerification.btnReject")}
                              </Button>
                            </div>
                          </div>
                        ) : String(app.status).toLowerCase() === "rejected" && app.rejection_reason ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                            <p className="text-sm font-medium text-destructive">{t("adminVerification.rejectionReasonLabel")}</p>
                            <p className="text-sm mt-1">{app.rejection_reason}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {String(app.status).toLowerCase() === "approved"
                              ? "Заявка одобрена — решение принято."
                              : "Решение не требуется."}
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card role="status">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {supSearch.trim() ? "Ничего не найдено" : "Нет заявок поставщиков"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {editingDoctor ? (
        <Suspense fallback={editDialogFallback}>
          <EditDoctorApplicationDialog
            application={editingDoctor}
            open={!!editingDoctor}
            onOpenChange={(open) => !open && setEditingDoctor(null)}
          />
        </Suspense>
      ) : null}

      {editingClinic ? (
        <Suspense fallback={editDialogFallback}>
          <EditClinicApplicationDialog
            application={editingClinic}
            open={!!editingClinic}
            onOpenChange={(open) => !open && setEditingClinic(null)}
          />
        </Suspense>
      ) : null}
    </AdminLayout>
  );
}
