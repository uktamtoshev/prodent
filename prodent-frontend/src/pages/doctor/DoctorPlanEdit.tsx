import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  Edit2,
  FlaskConical,
  Link2,
  Loader2,
  Plus,
  Printer,
  Save,
  Stethoscope,
  Trash2,
  Unlink,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import {
  buildTreatmentPlanPublicUrl,
  createTreatmentPlanShareLink,
  revokeTreatmentPlanShareLink,
} from "@/lib/treatment-plan-links";
import { updateTreatmentPlan } from "@/lib/treatment-plans-api";
import { loadActiveClinicServiceOptions } from "@/lib/clinic-services";
import { buildDoctorLabOrderPath } from "@/lib/lab-order-links";
import { formatPatientCardId } from "@/lib/accountId";

interface PlanItem {
  id: string;
  service_id: string | null;
  description: string;
  tooth_number: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  sort_order: number | null;
  stage_name: string | null;
  notes: string | null;
}

interface Plan {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  status: string;
  total_cost: number | string | null;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number | string;
  discount_amount: number | string;
  discount_comment: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

const fmtSum = (n: number) => Math.round(n || 0).toLocaleString("ru-RU");
const DEFAULT_UNIT_PRICE = 1;
const MAX_PLAN_ITEMS = 100;
const MAX_ITEM_QUANTITY = 1000;
const MAX_MONEY = 9_999_999_999.99;
const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const nonNegativeNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const LANGUAGE_LOCALES: Record<string, string> = {
  ru: "ru-RU",
  uz: "uz-UZ",
  uz_cyrl: "uz-Cyrl-UZ",
  kz: "kk-KZ",
  kg: "ky-KG",
  tj: "tg-TJ",
};

type DiscType = "percent" | "sum";
type ShareStatus =
  "idle" | "creating" | "ready" | "revoking" | "revoked" | "error";

class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export default function DoctorPlanEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { doctorId: currentDoctorId, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(true);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [installments, setInstallments] = useState<1 | 3 | 6 | 12>(1);
  const [overallDisc, setOverallDisc] = useState<{
    type: DiscType;
    val: number;
  }>({
    type: "percent",
    val: 0,
  });
  const [discountComment, setDiscountComment] = useState("");
  const [rows, setRows] = useState<PlanItem[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["treatment-plan", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      return (data || null) as Plan | null;
    },
    enabled: !!id,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["treatment-plan-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plan_items")
        .select("*")
        .eq("treatment_plan_id", id!)
        .order("sort_order", { ascending: true });
      return (data || []) as PlanItem[];
    },
    enabled: !!id,
  });
  const isTerminalPlan =
    plan?.status === "COMPLETED" || plan?.status === "CANCELLED";

  const { data: patient } = useQuery({
    queryKey: ["plan-patient", plan?.patient_id],
    queryFn: async () => {
      if (!plan?.patient_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, account_number")
        .eq("id", plan.patient_id)
        .maybeSingle();
      return data as { id: string; full_name: string | null; account_number: string | null } | null;
    },
    enabled: !!plan?.patient_id,
  });

  // Sync DB → local state when loaded
  useEffect(() => {
    if (plan) {
      setTitle(plan.title || "");
      setComment(plan.description || "");
      setOverallDisc({
        type: plan.discount_type === "FIXED" ? "sum" : "percent",
        val: nonNegativeNumber(plan.discount_value),
      });
      setDiscountComment(plan.discount_comment || "");
      if (plan.status === "COMPLETED" || plan.status === "CANCELLED") {
        setEditMode(false);
      }
    }
  }, [plan]);

  useEffect(() => {
    if (items) setRows(items);
  }, [items]);

  const totals = useMemo(() => {
    const gross = roundMoney(
      rows.reduce(
        (sum, row) => sum + Number(row.unit_price) * Number(row.quantity),
        0,
      ),
    );
    const lineDiscounts = 0;
    const afterLines = gross - lineDiscounts;
    const requestedDiscountValue = nonNegativeNumber(overallDisc.val);
    const discountValue =
      overallDisc.type === "percent"
        ? Math.min(requestedDiscountValue, 100)
        : Math.min(requestedDiscountValue, afterLines);
    const overallDiscount =
      overallDisc.type === "percent"
        ? roundMoney((afterLines * discountValue) / 100)
        : roundMoney(discountValue);
    const total = roundMoney(afterLines - overallDiscount);
    return { gross, lineDiscounts, discountValue, overallDiscount, total };
  }, [rows, overallDisc]);

  const totalDiscount = totals.lineDiscounts + totals.overallDiscount;
  const validationError = useMemo(() => {
    if (!title.trim()) return t("crmCreatePlanDialog.enterPlanName");
    if (rows.length === 0) return t("crmTreatmentForm.addAtLeastOneService");
    if (rows.length > MAX_PLAN_ITEMS)
      return "В плане может быть не больше 100 услуг";

    const blankDescriptionIndex = rows.findIndex(
      (row) => !row.description.trim(),
    );
    if (blankDescriptionIndex >= 0) {
      return `Услуга №${blankDescriptionIndex + 1}: заполните название`;
    }

    const invalidQuantityIndex = rows.findIndex((row) => {
      const quantity = Number(row.quantity);
      return !Number.isInteger(quantity) || quantity <= 0;
    });
    if (invalidQuantityIndex >= 0) {
      return `Услуга №${invalidQuantityIndex + 1}: количество должно быть целым числом больше 0`;
    }

    const excessiveQuantityIndex = rows.findIndex(
      (row) => Number(row.quantity) > MAX_ITEM_QUANTITY,
    );
    if (excessiveQuantityIndex >= 0) {
      return `Услуга №${excessiveQuantityIndex + 1}: количество не может быть больше 1000`;
    }

    const invalidPriceIndex = rows.findIndex((row) => {
      const unitPrice = Number(row.unit_price);
      return !Number.isFinite(unitPrice) || unitPrice <= 0;
    });
    if (invalidPriceIndex >= 0) {
      return `Услуга №${invalidPriceIndex + 1}: цена должна быть больше 0`;
    }

    const excessivePriceIndex = rows.findIndex(
      (row) => Number(row.unit_price) > MAX_MONEY,
    );
    if (excessivePriceIndex >= 0) {
      return `Услуга №${excessivePriceIndex + 1}: цена слишком большая`;
    }
    const overflowIndex = rows.findIndex(
      (row) => Number(row.unit_price) * Number(row.quantity) > MAX_MONEY,
    );
    if (overflowIndex >= 0 || totals.gross > MAX_MONEY) {
      return "Сумма услуги или всего плана слишком большая";
    }

    const discountValue = Number(overallDisc.val);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return "Скидка должна быть числом не меньше 0";
    }
    if (overallDisc.type === "percent" && discountValue > 100) {
      return "Скидка в процентах не может быть больше 100%";
    }
    if (overallDisc.type === "sum" && discountValue > totals.gross) {
      return "Фиксированная скидка не может быть больше суммы услуг";
    }

    return null;
  }, [overallDisc, rows, t, title, totals.gross]);
  const planNumber = useMemo(() => {
    if (!plan) return "—";
    return plan.id.slice(0, 4).toUpperCase();
  }, [plan]);
  const createdLabel = plan
    ? format(new Date(plan.created_at), "d MMMM yyyy", { locale: ru })
    : "";

  const updateRow = (rowId: string, patch: Partial<PlanItem>) =>
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));

  const deleteRow = (rowId: string) =>
    setRows((rs) => rs.filter((r) => r.id !== rowId));

  /**
   * The clinic's price list.
   *
   * Plan items used to be free text: the doctor typed a service name and a
   * price by hand, so `service_id` stayed NULL on every row. Consequences that
   * are not cosmetic — the plan could not be reconciled against the price list,
   * finance and reports had nothing to group by, and two doctors billed the same
   * procedure at different prices from memory.
   *
   * Picking from the catalogue fills the name, the price and the `service_id`
   * link in one action. Free typing stays available on purpose: a plan
   * legitimately contains one-off work, and a clinic mid-setup may have an empty
   * catalogue — losing the ability to write a row would be worse than a missing
   * link. Rows entered by hand simply keep `service_id` NULL, as before.
   */
  const serviceOptions = useQuery({
    queryKey: ["plan-edit-services", plan?.clinic_id, language],
    queryFn: () => loadActiveClinicServiceOptions(plan!.clinic_id, language),
    enabled: !!plan?.clinic_id,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Apply a catalogue pick to a row. The price is copied ONCE, at pick time,
   * and stays editable: a plan is a quote the doctor may discount, and it must
   * not silently change when the clinic re-prices the service later.
   */
  const pickService = (rowId: string, serviceId: string) => {
    const option = serviceOptions.data?.find((item) => item.id === serviceId);
    if (!option) return;
    updateRow(rowId, {
      service_id: option.id,
      description: option.name,
      unit_price: option.price,
    });
  };

  const addRow = () => {
    if (rows.length >= MAX_PLAN_ITEMS) {
      toast.error("В плане может быть не больше 100 услуг");
      return;
    }
    // Rows added here are persisted on "Save" (INSERT into treatment_plan_items).
    const tempId = "new-" + Date.now();
    setRows((rs) => [
      ...rs,
      {
        id: tempId,
        service_id: null,
        description: t("doctorPlanEdit.newService"),
        tooth_number: null,
        quantity: 1,
        unit_price: DEFAULT_UNIT_PRICE,
        total_price: DEFAULT_UNIT_PRICE,
        status: "PLANNED",
        sort_order: rs.length,
        stage_name: null,
        notes: null,
      },
    ]);
  };

  // Temporary ids never leave the page. The dedicated PUT treats an omitted id
  // as a new row and commits the complete ordered snapshot atomically.
  const isNewRow = (rowId: string) => rowId.startsWith("new-");

  const dirty = useMemo(() => {
    if (!plan) return false;
    if ((title || "") !== (plan.title || "")) return true;
    if ((comment || "") !== (plan.description || "")) return true;
    const persistedDiscountType =
      plan.discount_type === "FIXED" ? "sum" : "percent";
    if (overallDisc.type !== persistedDiscountType) return true;
    if (
      nonNegativeNumber(overallDisc.val) !==
      nonNegativeNumber(plan.discount_value)
    )
      return true;
    if ((discountComment.trim() || "") !== (plan.discount_comment || ""))
      return true;
    const original = items || [];
    if (rows.length !== original.length) return true;
    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const o = original[index];
      if (
        !o ||
        r.id !== o.id ||
        (r.service_id ?? null) !== (o.service_id ?? null) ||
        r.description !== o.description ||
        (r.tooth_number ?? null) !== (o.tooth_number ?? null) ||
        Number(r.quantity) !== Number(o.quantity) ||
        Number(r.unit_price) !== Number(o.unit_price) ||
        (r.stage_name ?? null) !== (o.stage_name ?? null) ||
        (r.notes ?? null) !== (o.notes ?? null)
      ) {
        return true;
      }
    }
    return false;
  }, [plan, items, rows, title, comment, overallDisc, discountComment]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!plan) throw new Error("no plan");
      if (isTerminalPlan) {
        throw new PlanValidationError(
          "Завершённый или отменённый план нельзя изменять",
        );
      }
      if (validationError) throw new PlanValidationError(validationError);
      return updateTreatmentPlan(plan.id, {
        title: title.trim(),
        description: comment.trim() || null,
        discountType: overallDisc.type === "percent" ? "PERCENT" : "FIXED",
        discountValue: Number(overallDisc.val),
        discountComment: discountComment.trim() || null,
        items: rows.map((row) => ({
          ...(isNewRow(row.id) ? {} : { id: row.id }),
          serviceId: row.service_id,
          toothNumber: row.tooth_number,
          description: row.description.trim(),
          quantity: Number(row.quantity),
          unitPrice: Number(row.unit_price),
          stageName: row.stage_name,
          notes: row.notes,
        })),
      });
    },
    onSuccess: () => {
      toast.success("План сохранён");
      queryClient.invalidateQueries({ queryKey: ["treatment-plan", id] });
      queryClient.invalidateQueries({ queryKey: ["treatment-plan-items", id] });
      queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof PlanValidationError
          ? error.message
          : "Не удалось сохранить план",
      );
    },
  });

  const formatShareExpiry = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language] || "ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const handleCreateShareLink = async () => {
    if (!plan?.id || shareStatus === "creating" || shareStatus === "revoking")
      return;
    setShareStatus("creating");
    try {
      const result = await createTreatmentPlanShareLink(plan.id);
      // The secret exists only in component memory until this page is closed.
      setShareUrl(buildTreatmentPlanPublicUrl(result.token));
      setShareExpiresAt(result.expiresAt);
      setShareStatus("ready");
      toast.success(t("doctorPlanEdit.shareCreated"));
    } catch {
      setShareStatus("error");
      toast.error(t("doctorPlanEdit.shareCreateError"));
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement("textarea");
        input.value = shareUrl;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("copy failed");
      }
      toast.success(t("doctorPlanEdit.shareCopied"));
    } catch {
      toast.error(t("doctorPlanEdit.shareCopyError"));
    }
  };

  const handleRevokeShareLink = async () => {
    if (!plan?.id || shareStatus === "creating" || shareStatus === "revoking")
      return;
    setShareStatus("revoking");
    try {
      await revokeTreatmentPlanShareLink(plan.id);
      setShareUrl(null);
      setShareExpiresAt(null);
      setShareStatus("revoked");
      toast.success(t("doctorPlanEdit.shareRevoked"));
    } catch {
      setShareStatus("error");
      toast.error(t("doctorPlanEdit.shareRevokeError"));
    }
  };

  const cols = "28px 1fr 74px 140px 140px 68px";

  if (planLoading || itemsLoading) {
    return (
      <DoctorLayout>
        <div
          className="flex h-cabinet items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="h-6 w-6 animate-spin text-primary"
            aria-hidden="true"
          />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </DoctorLayout>
    );
  }

  if (!plan) {
    return (
      <DoctorLayout>
        <div className="flex h-cabinet items-center justify-center">
          <div className="text-center">
            <div className="font-heading text-base font-bold text-foreground">
              {t("doctorPlanEdit.title")}
            </div>
            <button
              onClick={() => navigate("/doctor/treatment-plans")}
              className="mt-3 inline-flex min-h-11 items-center rounded-md px-3 text-sm text-primary hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("doctor.backToList")}
            </button>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  const patientName = patient?.full_name || t("doctor.patient");
  const patientCardId = formatPatientCardId(patient?.account_number, plan.patient_id);
  const canManageShareLink = !roleLoading && currentDoctorId === plan.doctor_id;

  return (
    <DoctorLayout>
      <div className="h-full min-w-0 overflow-auto bg-background">
        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-border bg-background">
          <div className="mx-auto flex min-h-16 max-w-[960px] flex-wrap items-center gap-2 px-4 py-2 sm:gap-3 sm:px-8">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("doctorPlanEdit.backToVisit")}
            </button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted-foreground">
              {t("doctorPlanEdit.planNumber")} {planNumber} · {patientName} ·
              #P-{patientCardId}
            </div>

            <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={
                  isTerminalPlan ||
                  !dirty ||
                  saveMutation.isPending ||
                  Boolean(validationError)
                }
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isTerminalPlan ||
                    !dirty ||
                    saveMutation.isPending ||
                    validationError
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                title={
                  isTerminalPlan
                    ? "Завершённый или отменённый план нельзя изменять"
                    : validationError || "Сохранить"
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Сохранить
              </button>

              <div className="mx-0.5 h-4 w-px bg-border" />

              <button
                onClick={() => setEditMode((m) => !m)}
                disabled={isTerminalPlan}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isTerminalPlan
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : editMode
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title={
                  isTerminalPlan
                    ? "Завершённый или отменённый план нельзя изменять"
                    : editMode
                      ? t("doctorPlanEdit.editDisable")
                      : t("doctorPlanEdit.editEnable")
                }
              >
                {editMode ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Edit2 className="h-3.5 w-3.5" />
                )}
                {editMode
                  ? t("doctorPlanEdit.editingMode")
                  : t("doctorPlanEdit.edit")}
              </button>

              <div className="mx-0.5 h-4 w-px bg-border" />

              <button
                onClick={() => toast.info(t("doctorPlanEdit.pdfSoon"))}
                aria-label={t("doctorPlanEdit.downloadPdf")}
                className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={t("doctorPlanEdit.downloadPdf")}
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => window.print()}
                aria-label={t("doctorPlanEdit.print")}
                className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={t("doctorPlanEdit.print")}
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                onClick={() => toast.info(t("doctorPlanEdit.doctorViewSoon"))}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Stethoscope className="h-3.5 w-3.5" />
                {t("doctorPlanEdit.doctorView")}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-8 sm:py-8">
          {/* Header — document */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editMode ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={!title.trim()}
                  placeholder={t("doctorPlanEdit.planNamePlaceholder")}
                  className={cn(
                    "-mx-1 min-h-11 w-full max-w-[560px] rounded bg-transparent px-2 font-heading text-2xl font-bold tracking-tight text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-ring",
                    !title.trim()
                      ? "ring-1 ring-destructive/40 focus:ring-destructive"
                      : "focus:ring-primary/40",
                  )}
                />
              ) : (
                <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
                  {title || t("doctorPlanEdit.planNamePlaceholder")}
                </h1>
              )}
              {editMode ? (
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("doctorPlanEdit.commentPlaceholder")}
                  className="-mx-1 mt-1 min-h-11 w-full max-w-[540px] rounded bg-transparent px-2 text-sm text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-ring"
                />
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">
                  {comment}
                </div>
              )}
            </div>
            <div className="shrink-0 text-left text-xs tabular-nums text-muted-foreground sm:text-right">
              <div>
                № {planNumber} · {createdLabel}
              </div>
              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                <span>{t("doctorPlanEdit.validUntil")}</span>
                {editMode ? (
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="min-h-11 rounded border border-border bg-background px-2 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <span className="font-medium text-foreground">
                    {format(new Date(validUntil), "d MMMM yyyy", {
                      locale: ru,
                    })}
                  </span>
                )}
              </div>
              <div>
                {t("doctorPlanEdit.patient")}:{" "}
                <span className="font-medium text-foreground">
                  {patientName}
                </span>
              </div>
            </div>
          </div>

          {validationError && (
            <div
              role="alert"
              className="mb-5 rounded-prodent-input border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
            >
              Нельзя сохранить: {validationError}
            </div>
          )}

          {/* Only the authoring doctor can use the dedicated share-link API. */}
          {canManageShareLink && (
            <section className="mb-5 rounded-prodent-btn border border-primary/30 bg-primary/5 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[9px] bg-background text-primary ring-1 ring-primary/30">
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-heading text-base font-bold text-foreground">
                        {t("doctorPlanEdit.shareTitle")}
                      </h2>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {t("doctorPlanEdit.shareDescription")}
                      </p>
                    </div>
                  </div>

                  {shareUrl && shareExpiresAt && (
                    <div className="mt-3 rounded-[8px] bg-background px-3 py-2.5 ring-1 ring-primary/30">
                      <div
                        className="truncate font-mono text-xs text-muted-foreground"
                        aria-hidden="true"
                      >
                        {window.location.origin}/treatment-plan#t=••••••••••••
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("doctorPlanEdit.shareExpires")}{" "}
                        {formatShareExpiry(shareExpiresAt)}
                      </div>
                    </div>
                  )}

                  {shareStatus === "revoked" && (
                    <p
                      className="mt-3 text-xs font-medium text-status-success"
                      role="status"
                    >
                      {t("doctorPlanEdit.shareRevokedText")}
                    </p>
                  )}
                  {shareStatus === "error" && (
                    <p
                      className="mt-3 text-xs font-medium text-destructive"
                      role="alert"
                    >
                      {t("doctorPlanEdit.shareErrorText")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {shareUrl ? (
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      disabled={shareStatus === "revoking"}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("doctorPlanEdit.shareCopy")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateShareLink}
                      disabled={
                        shareStatus === "creating" || shareStatus === "revoking"
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {shareStatus === "creating" ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {shareStatus === "creating"
                        ? t("doctorPlanEdit.shareCreating")
                        : t("doctorPlanEdit.shareCreate")}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRevokeShareLink}
                    disabled={
                      shareStatus === "creating" || shareStatus === "revoking"
                    }
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shareStatus === "revoking" ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {shareStatus === "revoking"
                      ? t("doctorPlanEdit.shareRevoking")
                      : t("doctorPlanEdit.shareRevoke")}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Table */}
          <div
            className="overflow-x-auto rounded-prodent-btn bg-card ring-1 ring-border"
            role="region"
            aria-label={t("doctorPlanEdit.title")}
            tabIndex={0}
          >
            <div className="min-w-[760px]">
              <div
                className="grid items-center gap-2 border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ gridTemplateColumns: cols }}
              >
                <span>{t("doctorPlanEdit.colNumber")}</span>
                <span>{t("doctorPlanEdit.colService")}</span>
                <span className="text-center">
                  {t("doctorPlanEdit.colQty")}
                </span>
                <span className="text-right">
                  {t("doctorPlanEdit.colPrice")}
                </span>
                <span className="text-right">{t("doctorPlanEdit.colSum")}</span>
                <span />
              </div>

              {rows.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {t("doctorPlanEdit.noServicesYet")}
                </div>
              )}

              {rows.map((r, i) => {
                const gross = r.unit_price * r.quantity;
                const rowEditable = editMode && r.status === "PLANNED";
                return (
                  <div
                    key={r.id}
                    className="group grid items-center gap-2 border-b border-border px-5 py-2.5 text-sm hover:bg-muted/40"
                    style={{ gridTemplateColumns: cols }}
                  >
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>

                    {/* Service + tooth */}
                    <div className="min-w-0">
                      {rowEditable ? (
                        <>
                          {/* Catalogue picker: fills name, price and the
                              service_id link in one action. Native select so it
                              works on a tablet at the chair without a portal. */}
                          {serviceOptions.data && serviceOptions.data.length > 0 ? (
                            <select
                              value={r.service_id ?? ""}
                              onChange={(e) =>
                                e.target.value
                                  ? pickService(r.id, e.target.value)
                                  : updateRow(r.id, { service_id: null })
                              }
                              aria-label={t("doctorPlanEdit.pickFromPriceList")}
                              className="-mx-1 mb-1 h-11 w-full rounded border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="">
                                {t("doctorPlanEdit.pickFromPriceList")}
                              </option>
                              {serviceOptions.data.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <input
                            value={r.description}
                            onChange={(e) =>
                              // Editing the text by hand detaches the row from
                              // the catalogue: keeping a stale service_id next
                              // to a renamed line would be a false link.
                              updateRow(r.id, {
                                description: e.target.value,
                                service_id: null,
                              })
                            }
                            aria-invalid={!r.description.trim()}
                            placeholder={t("doctorPlanEdit.serviceName")}
                            className={cn(
                              "-mx-1 min-h-11 w-full rounded bg-transparent px-2 py-0.5 font-heading text-sm font-medium text-foreground outline-none focus:bg-background focus:ring-1",
                              !r.description.trim()
                                ? "ring-1 ring-destructive/40 focus:ring-destructive"
                                : "focus:ring-primary/40",
                            )}
                          />
                          {serviceOptions.data && serviceOptions.data.length > 0 && !r.service_id ? (
                            <p className="px-1 text-xs text-muted-foreground">
                              {t("doctorPlanEdit.customServiceHint")}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <div className="py-0.5 font-heading font-medium text-foreground">
                          {r.description}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{t("doctorPlanEdit.tooth")}</span>
                        {rowEditable ? (
                          <input
                            value={r.tooth_number ?? ""}
                            onChange={(e) =>
                              updateRow(r.id, {
                                tooth_number: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="—"
                            className="h-11 w-14 rounded border border-border bg-background px-1 text-center text-xs font-semibold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ) : (
                          <span className="font-semibold tabular-nums text-foreground">
                            {r.tooth_number ?? "—"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity */}
                    {rowEditable ? (
                      <input
                        type="number"
                        min="1"
                        max={MAX_ITEM_QUANTITY}
                        value={r.quantity}
                        onChange={(e) =>
                          updateRow(r.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                        aria-invalid={
                          !Number.isInteger(Number(r.quantity)) ||
                          Number(r.quantity) <= 0 ||
                          Number(r.quantity) > MAX_ITEM_QUANTITY
                        }
                        className={cn(
                          "h-11 w-full rounded-[6px] border bg-background text-center text-sm tabular-nums text-foreground outline-none focus:ring-2",
                          !Number.isInteger(Number(r.quantity)) ||
                            Number(r.quantity) <= 0 ||
                            Number(r.quantity) > MAX_ITEM_QUANTITY
                            ? "border-destructive focus:ring-destructive/30"
                            : "border-border focus:ring-ring",
                        )}
                      />
                    ) : (
                      <span className="text-center tabular-nums text-foreground">
                        {r.quantity}
                      </span>
                    )}

                    {/* Unit price */}
                    {rowEditable ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0.01"
                          max={MAX_MONEY}
                          step="0.01"
                          value={r.unit_price}
                          onChange={(e) =>
                            updateRow(r.id, {
                              unit_price: Number(e.target.value),
                            })
                          }
                          aria-invalid={
                            !Number.isFinite(Number(r.unit_price)) ||
                            Number(r.unit_price) <= 0 ||
                            Number(r.unit_price) > MAX_MONEY
                          }
                          className={cn(
                            "h-11 w-full rounded-[6px] border bg-background pr-9 text-right text-sm tabular-nums text-foreground outline-none focus:ring-2",
                            !Number.isFinite(Number(r.unit_price)) ||
                              Number(r.unit_price) <= 0 ||
                              Number(r.unit_price) > MAX_MONEY
                              ? "border-destructive focus:ring-destructive/30"
                              : "border-border focus:ring-ring",
                          )}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {t("doctorPlanEdit.sumUnit")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-right tabular-nums text-foreground">
                        {fmtSum(r.unit_price)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {t("doctorPlanEdit.sumUnit")}
                        </span>
                      </span>
                    )}

                    {/* Total */}
                    <span className="text-right font-heading font-semibold tabular-nums text-foreground">
                      {fmtSum(gross)}
                    </span>

                    {/* Lab order + delete */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={isNewRow(r.id)}
                        onClick={() =>
                          navigate(
                            buildDoctorLabOrderPath({
                              patientId: plan.patient_id,
                              treatmentPlanId: plan.id,
                              treatmentPlanItemId: r.id,
                            }),
                          )
                        }
                        aria-label={
                          isNewRow(r.id)
                            ? "Сначала сохраните услугу"
                            : "Заказать в лаборатории"
                        }
                        className="grid h-11 w-11 place-items-center rounded-[6px] text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground/50"
                        title={
                          isNewRow(r.id)
                            ? "Сначала сохраните услугу"
                            : "Заказать в лаборатории"
                        }
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                      </button>
                      {rowEditable && (
                        <button
                          type="button"
                          onClick={() => deleteRow(r.id)}
                          aria-label={t("doctorPlanEdit.removeService")}
                          className="grid h-11 w-11 place-items-center rounded-[6px] text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={t("doctorPlanEdit.removeService")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {editMode && (
                <button
                  onClick={addRow}
                  className="inline-flex min-h-11 w-full items-center gap-2 border-b border-border px-5 py-3 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Plus className="h-4 w-4" />
                  {t("doctorPlanEdit.addService")}
                </button>
              )}

              {/* Totals */}
              <div className="bg-muted/40 px-5 py-4">
                <div className="ml-auto max-w-[440px] space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("doctorPlanEdit.total")}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {fmtSum(totals.gross)} {t("doctorPlanEdit.sumUnit")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {t("doctorPlanEdit.discount")}
                      </span>
                      {editMode && (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5 rounded-[6px] border border-border bg-background p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                setOverallDisc((current) => ({
                                  ...current,
                                  type: "percent",
                                }))
                              }
                              className={cn(
                                "min-h-11 rounded-[4px] px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                overallDisc.type === "percent"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOverallDisc((current) => ({
                                  ...current,
                                  type: "sum",
                                }))
                              }
                              className={cn(
                                "min-h-11 rounded-[4px] px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                overallDisc.type === "sum"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {t("doctorPlanEdit.sumUnit")}
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={
                              overallDisc.type === "percent"
                                ? 100
                                : totals.gross
                            }
                            step="1"
                            value={overallDisc.val}
                            onChange={(e) =>
                              setOverallDisc((current) => ({
                                ...current,
                                val: Number(e.target.value),
                              }))
                            }
                            aria-invalid={
                              !Number.isFinite(Number(overallDisc.val)) ||
                              Number(overallDisc.val) < 0 ||
                              (overallDisc.type === "percent" &&
                                Number(overallDisc.val) > 100) ||
                              (overallDisc.type === "sum" &&
                                Number(overallDisc.val) > totals.gross)
                            }
                            placeholder="0"
                            className={cn(
                              "h-11 w-20 rounded-[6px] border bg-background px-2 text-right text-xs font-semibold tabular-nums text-foreground outline-none focus:ring-2",
                              !Number.isFinite(Number(overallDisc.val)) ||
                                Number(overallDisc.val) < 0 ||
                                (overallDisc.type === "percent" &&
                                  Number(overallDisc.val) > 100) ||
                                (overallDisc.type === "sum" &&
                                  Number(overallDisc.val) > totals.gross)
                                ? "border-destructive focus:ring-destructive/30"
                                : "border-border focus:ring-ring",
                            )}
                          />
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        totalDiscount > 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {totalDiscount > 0
                        ? `− ${fmtSum(totalDiscount)} ${t("doctorPlanEdit.sumUnit")}`
                        : "—"}
                    </span>
                  </div>

                  {editMode ? (
                    <input
                      value={discountComment}
                      onChange={(event) =>
                        setDiscountComment(event.target.value)
                      }
                      maxLength={2000}
                      aria-label={t("crmTreatmentForm.reasonOptional")}
                      placeholder={t("crmTreatmentForm.reasonOptional")}
                      className="min-h-11 w-full rounded-[6px] border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : discountComment ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {discountComment}
                    </p>
                  ) : null}

                  <div className="my-1 h-px bg-border" />
                  <div className="flex justify-between pt-1 font-heading text-lg font-bold">
                    <span>{t("doctorPlanEdit.discountedTotal")}</span>
                    <span className="tabular-nums text-primary">
                      {fmtSum(totals.total)} {t("doctorPlanEdit.sumUnit")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Installments */}
          <div className="mt-5 rounded-prodent-btn bg-card p-5 ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
                {t("doctorPlanEdit.installments")}
              </h2>
              <div className="text-xs text-muted-foreground">
                {t("doctorPlanEdit.noOverpayment")}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { n: 1 as const, label: t("doctorPlanEdit.onePayment") },
                { n: 3 as const, label: t("doctorPlanEdit.months3") },
                { n: 6 as const, label: t("doctorPlanEdit.months6") },
                { n: 12 as const, label: t("doctorPlanEdit.months12") },
              ].map((opt) => {
                const active = installments === opt.n;
                const perMonth =
                  opt.n === 1 ? totals.total : Math.round(totals.total / opt.n);
                return (
                  <button
                    key={opt.n}
                    onClick={() => setInstallments(opt.n)}
                    className={cn(
                      "min-h-11 rounded-prodent-input border-2 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="mb-1 text-xs text-muted-foreground">
                      {opt.label}
                    </div>
                    <div
                      className={cn(
                        "font-heading text-lg font-bold leading-none tabular-nums",
                        active
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {fmtSum(perMonth)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {opt.n === 1
                        ? t("doctorPlanEdit.sumUnit")
                        : t("doctorPlanEdit.perMonth")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <div>{t("doctorPlanEdit.footerAddress")}</div>
            <div>{t("doctorPlanEdit.footerDoctor")}</div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
