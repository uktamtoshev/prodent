import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, FileText, CheckCircle, Smile, ShieldCheck,
  ChevronDown, ChevronUp, Percent, Hash, Sparkles, BarChart3, FileDown,
  Pencil, GripVertical
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TreatmentPlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId: string;
  clinicId: string;
  planId?: string;
  onSuccess?: () => void;
}

interface PlanItem {
  id?: string;
  service_id?: string;
  procedure: string;
  tooth_number: string;
  is_general: boolean;
  quantity: number;
  price: number;
  stage_name: string;
  notes: string;
}

interface Stage {
  name: string;
  items: (PlanItem & { _index: number })[];
  collapsed: boolean;
}

interface ClinicService {
  id: string;
  name: string;
  price: number;
  category: string;
}

const GENERAL_PROCEDURES = [
  { name: "Профессиональная чистка зубов", category: "Гигиена" },
  { name: "Ультразвуковая чистка", category: "Гигиена" },
  { name: "Air-Flow чистка", category: "Гигиена" },
  { name: "Отбеливание зубов", category: "Эстетика" },
  { name: "Установка брекетов", category: "Ортодонтия" },
  { name: "Снятие брекетов", category: "Ортодонтия" },
  { name: "Установка элайнеров", category: "Ортодонтия" },
  { name: "Коррекция брекетов", category: "Ортодонтия" },
  { name: "Ретейнер", category: "Ортодонтия" },
  { name: "Фторирование", category: "Профилактика" },
  { name: "Реминерализация", category: "Профилактика" },
  { name: "Консультация", category: "Общее" },
  { name: "Панорамный снимок", category: "Диагностика" },
  { name: "КТ челюсти", category: "Диагностика" },
];

const TOOTH_NUMBERS = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  38, 37, 36, 35, 34, 33, 32, 31,
  41, 42, 43, 44, 45, 46, 47, 48,
];

const DEFAULT_STAGE = "Этап 1";

export function TreatmentPlanForm({
  open,
  onOpenChange,
  patientId,
  doctorId,
  clinicId,
  planId,
  onSuccess,
}: TreatmentPlanFormProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountComment, setDiscountComment] = useState("");
  const [patientConsent, setPatientConsent] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [addMode, setAddMode] = useState<"tooth" | "general">("tooth");

  // Queries
  const { data: patient } = useQuery({
    queryKey: ["patient-info", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", patientId).single();
      return data;
    },
    enabled: !!patientId,
  });

  const { data: doctor } = useQuery({
    queryKey: ["doctor-info", doctorId],
    queryFn: async () => {
      const { data } = await supabase.from("doctors").select("id, user_id, profiles:user_id(full_name)").eq("id", doctorId).single();
      return data;
    },
    enabled: !!doctorId,
  });

  const { data: clinic } = useQuery({
    queryKey: ["clinic-info", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("name, address, phone").eq("id", clinicId).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["clinic-services", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, category")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("category")
        .order("name");
      return (data || []) as ClinicService[];
    },
    enabled: !!clinicId,
  });

  const { data: existingPlan } = useQuery({
    queryKey: ["treatment-plan", planId],
    queryFn: async () => {
      const { data: plan } = await supabase.from("treatment_plans").select("*").eq("id", planId).single();
      const { data: planItems } = await supabase.from("treatment_plan_items").select("*").eq("plan_id", planId).order("created_at");
      return { plan, items: planItems || [] };
    },
    enabled: !!planId,
  });

  useEffect(() => {
    if (existingPlan?.plan) {
      const dtype = existingPlan.plan.discount_type;
      if (dtype === "percent" || dtype === "fixed") setDiscountType(dtype);
      setDiscountValue(existingPlan.plan.discount_value || 0);
      setDiscountComment(existingPlan.plan.discount_comment || "");
      setPatientConsent(existingPlan.plan.patient_consent || false);
      if (existingPlan.plan.discount_value > 0) setShowDiscount(true);
      if (existingPlan.items.length > 0) {
        setItems(existingPlan.items.map((item: any) => ({
          id: item.id,
          service_id: item.service_id,
          procedure: item.procedure,
          tooth_number: item.tooth_number?.toString() || "",
          is_general: !item.tooth_number,
          quantity: item.quantity || 1,
          price: item.price || 0,
          stage_name: item.stage_name || DEFAULT_STAGE,
          notes: item.notes || "",
        })));
      }
    }
  }, [existingPlan]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services.slice(0, 10);
    const search = serviceSearch.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(search) || s.category.toLowerCase().includes(search)).slice(0, 10);
  }, [services, serviceSearch]);

  const filteredGeneralProcedures = useMemo(() => {
    if (!serviceSearch.trim()) return GENERAL_PROCEDURES;
    const search = serviceSearch.toLowerCase();
    return GENERAL_PROCEDURES.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));
  }, [serviceSearch]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let discount = 0;
    if (discountType === "percent") discount = Math.round(subtotal * discountValue / 100);
    else discount = discountValue;
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  }, [items, discountType, discountValue]);

  // Group items by stage
  const stages = useMemo((): Stage[] => {
    const stageMap = new Map<string, (PlanItem & { _index: number })[]>();
    items.forEach((item, index) => {
      const stageName = item.stage_name || DEFAULT_STAGE;
      if (!stageMap.has(stageName)) stageMap.set(stageName, []);
      stageMap.get(stageName)!.push({ ...item, _index: index });
    });
    return Array.from(stageMap.entries()).map(([name, stageItems]) => ({
      name,
      items: stageItems,
      collapsed: collapsedStages[name] || false,
    }));
  }, [items, collapsedStages]);

  const addItem = useCallback((isGeneral: boolean = false) => {
    const lastStage = items.length > 0 ? (items[items.length - 1].stage_name || DEFAULT_STAGE) : DEFAULT_STAGE;
    setItems(prev => [...prev, {
      procedure: "", tooth_number: "", is_general: isGeneral,
      quantity: 1, price: 0, stage_name: lastStage, notes: "",
    }]);
    setTimeout(() => setActiveItemIndex(items.length), 50);
  }, [items]);

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setActiveItemIndex(null);
  };

  const updateItem = (index: number, updates: Partial<PlanItem>) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  };

  const selectService = (index: number, service: ClinicService) => {
    updateItem(index, { service_id: service.id, procedure: service.name, price: service.price });
    setServiceSearch("");
    setActiveItemIndex(null);
  };

  const selectGeneralProcedure = (index: number, procedure: { name: string }) => {
    updateItem(index, { procedure: procedure.name, is_general: true, tooth_number: "" });
    setServiceSearch("");
    setActiveItemIndex(null);
  };

  const toggleStage = (stageName: string) => {
    setCollapsedStages(prev => ({ ...prev, [stageName]: !prev[stageName] }));
  };

  const addStage = () => {
    const stageNum = stages.length + 1;
    const newStageName = `Этап ${stageNum}`;
    setItems(prev => [...prev, {
      procedure: "", tooth_number: "", is_general: false,
      quantity: 1, price: 0, stage_name: newStageName, notes: "",
    }]);
  };

  const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price) + " UZS";

  const isApproved = existingPlan?.plan?.status === "approved";

  const handleSave = async (status: "draft" | "approved" = "draft") => {
    const validItems = items.filter(item => item.procedure.trim());
    if (validItems.length === 0) { toast.error("Добавьте хотя бы одну услугу"); return; }
    if (status === "approved" && !patientConsent) { toast.error("Необходимо подтверждение согласия пациента"); return; }
    if (!patientId?.trim()) { toast.error("Не указан пациент"); return; }
    if (!clinicId?.trim()) { toast.error("Не выбрана клиника"); return; }

    setSaving(true);
    if (status === "approved") setApproving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const validDoctorId = doctorId?.trim() || null;
      const planData = {
        patient_id: patientId, doctor_id: validDoctorId, clinic_id: clinicId,
        status, discount_type: discountType, discount_value: discountValue,
        discount_comment: discountComment || null, patient_consent: patientConsent,
        consent_at: patientConsent ? new Date().toISOString() : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? user?.id : null,
      };

      let finalPlanId = planId;
      if (planId) {
        const { error } = await supabase.from("treatment_plans").update(planData as any).eq("id", planId);
        if (error) throw error;
        await supabase.from("treatment_plan_items").delete().eq("plan_id", planId);
      } else {
        const { data: newPlan, error } = await supabase.from("treatment_plans").insert(planData as any).select().single();
        if (error) throw error;
        finalPlanId = newPlan.id;
      }

      const planItems = validItems.map(item => ({
        clinic_id: clinicId, plan_id: finalPlanId, service_id: item.service_id || null,
        procedure: item.procedure, tooth_number: item.is_general ? null : (item.tooth_number ? parseInt(item.tooth_number) : null),
        quantity: item.quantity, price: item.price, stage_name: item.stage_name || null,
        notes: item.notes || null, status: "planned",
      }));

      const { error: itemsError } = await supabase.from("treatment_plan_items").insert(planItems as any);
      if (itemsError) throw itemsError;

      toast.success(status === "approved" ? "План лечения утверждён" : "План лечения сохранён");
      queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
      setApproving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onOpenChange(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSave("approved"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientConsent, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-none text-foreground max-w-6xl max-h-[98vh] p-0 gap-0 overflow-hidden rounded-2xl shadow-strong">
        {/* ===== STICKY HEADER ===== */}
        <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Info */}
            <div className="flex items-center gap-6 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground leading-tight">
                    {planId ? "Редактировать план" : "Новый план лечения"}
                  </h2>
                  {existingPlan?.plan?.plan_number && (
                    <span className="text-xs text-muted-foreground font-mono">{existingPlan.plan.plan_number}</span>
                  )}
                </div>
              </div>
              <Separator orientation="vertical" className="h-8 hidden md:block" />
              <div className="hidden md:flex items-center gap-5 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Пациент</span>
                  <p className="font-medium text-foreground leading-tight truncate max-w-[140px]">{patient?.full_name || "..."}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Врач</span>
                  <p className="font-medium text-foreground leading-tight truncate max-w-[140px]">{(doctor?.profiles as any)?.full_name || "..."}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Клиника</span>
                  <p className="font-medium text-foreground leading-tight truncate max-w-[140px]">{clinic?.name || "..."}</p>
                </div>
              </div>
            </div>

            {/* Right: Status + Total */}
            <div className="flex items-center gap-4 shrink-0">
              {isApproved ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1.5 px-3 py-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Утверждён
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1 bg-warning-amber/10 text-warning-amber border-warning-amber/20">
                  <Pencil className="w-3.5 h-3.5" />
                  Черновик
                </Badge>
              )}
              <div className="text-right hidden sm:block">
                <span className="text-xs text-muted-foreground block">Итого</span>
                <span className="text-lg font-bold text-primary">{formatPrice(totals.total)}</span>
              </div>
              <span className="text-xs text-muted-foreground hidden lg:block">
                {format(new Date(), "dd MMM yyyy", { locale: ru })}
              </span>
            </div>
          </div>
        </div>

        {/* ===== SCROLLABLE CONTENT ===== */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5" style={{ maxHeight: "calc(98vh - 180px)" }}>

          {/* ===== ADD MODE SWITCH ===== */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setAddMode("tooth")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  addMode === "tooth"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-base">🦷</span>
                На зуб
              </button>
              <button
                type="button"
                onClick={() => setAddMode("general")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  addMode === "general"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-base">🧠</span>
                Общая процедура
              </button>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={() => addItem(addMode === "general")}
                      disabled={isApproved}
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить услугу
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {addMode === "tooth" ? "Добавить процедуру для конкретного зуба" : "Добавить общую процедуру"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button type="button" variant="outline" size="sm" onClick={addStage} disabled={isApproved} className="gap-2">
                <Plus className="w-4 h-4" />
                Новый этап
              </Button>
            </div>
          </div>

          {/* ===== STAGES ===== */}
          {items.length === 0 ? (
            /* Empty State */
            <div className="text-center py-16 px-8">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-primary/5 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Добавьте услуги</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Начните формировать план лечения. Система автоматически рассчитает итог,
                а пациент получит понятный PDF-документ.
              </p>
              <div className="flex justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🦷</span>
                  <span>Привязка к зубу</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>Авторасчёт</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-primary" />
                  <span>PDF для пациента</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {stages.map((stage) => {
                const stageTotal = stage.items.reduce((s, i) => s + i.price * i.quantity, 0);

                return (
                  <div
                    key={stage.name}
                    className="rounded-xl border border-border bg-card shadow-soft overflow-hidden transition-all duration-200"
                  >
                    {/* Stage Header */}
                    <button
                      type="button"
                      onClick={() => toggleStage(stage.name)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {stage.collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-semibold text-foreground">{stage.name}</span>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {stage.items.length} {stage.items.length === 1 ? "услуга" : "услуг"}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{formatPrice(stageTotal)}</span>
                    </button>

                    {/* Stage Content */}
                    {!stage.collapsed && (
                      <div className="border-t border-border">
                        {/* Table header */}
                        <div className="hidden md:grid grid-cols-[36px_80px_1fr_64px_100px_100px_36px] gap-3 px-5 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <span>№</span>
                          <span>Тип</span>
                          <span>Услуга</span>
                          <span>Кол-во</span>
                          <span className="text-right">Цена</span>
                          <span className="text-right">Итого</span>
                          <span />
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-border/50">
                          {stage.items.map((item) => {
                            const idx = item._index;
                            const lineTotal = item.price * item.quantity;

                            return (
                              <div
                                key={idx}
                                className="group grid grid-cols-1 md:grid-cols-[36px_80px_1fr_64px_100px_100px_36px] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors"
                              >
                                {/* Row num */}
                                <span className="hidden md:block text-sm text-muted-foreground font-medium">{idx + 1}</span>

                                {/* Type */}
                                <div className="hidden md:flex">
                                  {item.is_general ? (
                                    <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-primary/25 text-primary gap-1 whitespace-nowrap">
                                      <Smile className="w-3 h-3" />
                                      Общая
                                    </Badge>
                                  ) : (
                                    <Select
                                      value={item.tooth_number || "none"}
                                      onValueChange={(v) => updateItem(idx, { tooth_number: v === "none" ? "" : v })}
                                      disabled={isApproved}
                                    >
                                      <SelectTrigger className="h-8 text-xs w-[72px] bg-background border-border">
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60">
                                        <SelectItem value="none">—</SelectItem>
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">Верхняя</div>
                                        {TOOTH_NUMBERS.slice(0, 16).map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">Нижняя</div>
                                        {TOOTH_NUMBERS.slice(16).map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>

                                {/* Service */}
                                <div className="relative">
                                  <Input
                                    value={item.procedure}
                                    onChange={(e) => {
                                      updateItem(idx, { procedure: e.target.value, service_id: undefined });
                                      setServiceSearch(e.target.value);
                                      setActiveItemIndex(idx);
                                    }}
                                    onFocus={() => { setActiveItemIndex(idx); setServiceSearch(item.procedure); }}
                                    onBlur={() => setTimeout(() => setActiveItemIndex(null), 200)}
                                    placeholder={item.is_general ? "Общая процедура..." : "Введите услугу..."}
                                    className="h-9 bg-background border-border text-sm"
                                    disabled={isApproved}
                                  />
                                  {activeItemIndex === idx && (filteredServices.length > 0 || (item.is_general && filteredGeneralProcedures.length > 0)) && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto backdrop-blur-sm">
                                      {item.is_general && filteredGeneralProcedures.length > 0 && (
                                        <>
                                          <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground bg-muted/60 sticky top-0 uppercase tracking-wider border-b border-border/50">Популярные</div>
                                          {filteredGeneralProcedures.slice(0, 6).map((proc, i) => (
                                            <button key={i} type="button" className="w-full px-3 py-2.5 text-left hover:bg-primary/5 flex items-center justify-between text-sm transition-colors border-b border-border/20 last:border-b-0" onMouseDown={() => selectGeneralProcedure(idx, proc)}>
                                              <span className="truncate font-medium text-foreground">{proc.name}</span>
                                              <span className="text-[11px] text-muted-foreground ml-3 shrink-0 bg-muted/50 px-2 py-0.5 rounded-full">{proc.category}</span>
                                            </button>
                                          ))}
                                        </>
                                      )}
                                      {filteredServices.length > 0 && (
                                        <>
                                          <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground bg-muted/60 sticky top-0 uppercase tracking-wider border-b border-border/50">Прайс-лист</div>
                                          {filteredServices.map(service => (
                                            <button key={service.id} type="button" className="w-full px-3 py-2.5 text-left hover:bg-primary/5 flex items-center justify-between text-sm transition-colors border-b border-border/20 last:border-b-0" onMouseDown={() => selectService(idx, service)}>
                                              <span className="truncate font-medium text-foreground">{service.name}</span>
                                              <span className={cn("ml-3 shrink-0 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full", service.price > 0 ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted/50")}>{service.price > 0 ? formatPrice(service.price) : "—"}</span>
                                            </button>
                                          ))}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Qty */}
                                <Input
                                  type="number" min={1} value={item.quantity}
                                  onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="h-9 text-sm text-center bg-background border-border"
                                  disabled={isApproved}
                                />

                                {/* Price */}
                                <div className="relative">
                                  <Input
                                    type="number" min={0} value={item.price}
                                    onChange={(e) => updateItem(idx, { price: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className={cn("h-9 text-sm text-right bg-background border-border pr-7", item.price === 0 && "text-muted-foreground")}
                                    disabled={isApproved}
                                  />
                                  {!item.service_id && item.price > 0 && (
                                    <Pencil className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>

                                {/* Total */}
                                <div className={cn("h-9 flex items-center justify-end text-sm font-semibold px-2", lineTotal > 0 ? "text-foreground" : "text-muted-foreground")}>
                                  {formatPrice(lineTotal)}
                                </div>

                                {/* Delete */}
                                <div className="flex justify-center">
                                  {!isApproved && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add to this stage */}
                        {!isApproved && (
                          <div className="px-5 py-2 border-t border-dashed border-border/50">
                            <Button
                              type="button" variant="ghost" size="sm"
                              onClick={() => {
                                const stageName = stage.name;
                                setItems(prev => [...prev, {
                                  procedure: "", tooth_number: "", is_general: addMode === "general",
                                  quantity: 1, price: 0, stage_name: stageName, notes: "",
                                }]);
                              }}
                              className="text-xs text-muted-foreground hover:text-primary gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Добавить в этот этап
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== DISCOUNT ===== */}
          {!showDiscount ? (
            items.length > 0 && !isApproved && (
              <button
                type="button"
                onClick={() => setShowDiscount(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить скидку
              </button>
            )
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary" />
                  Скидка
                </h3>
                {!isApproved && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowDiscount(false); setDiscountValue(0); }}
                    className="text-xs text-muted-foreground">
                    Убрать
                  </Button>
                )}
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                  <button type="button" onClick={() => setDiscountType("percent")}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", discountType === "percent" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                    %
                  </button>
                  <button type="button" onClick={() => setDiscountType("fixed")}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", discountType === "fixed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                    UZS
                  </button>
                </div>
                <Input
                  type="number" min={0} max={discountType === "percent" ? 100 : undefined}
                  value={discountValue} onChange={(e) => setDiscountValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-32 bg-background border-border" placeholder="0" disabled={isApproved}
                />
                <Input
                  value={discountComment} onChange={(e) => setDiscountComment(e.target.value)}
                  className="flex-1 bg-background border-border" placeholder="Причина (опционально)" disabled={isApproved}
                />
              </div>
              <p className="text-xs text-muted-foreground">Скидка отображается в плане лечения пациента</p>
            </div>
          )}

          {/* ===== CONSENT ===== */}
          {items.length > 0 && (
            <div className={cn(
              "rounded-xl border p-5 transition-colors",
              patientConsent ? "bg-green-500/5 border-green-500/20" : "bg-card border-border"
            )}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={patientConsent}
                  onCheckedChange={(checked) => setPatientConsent(!!checked)}
                  disabled={isApproved}
                  className="mt-0.5"
                />
                <div className="flex items-start gap-2 flex-1">
                  <ShieldCheck className={cn("w-5 h-5 mt-0.5 shrink-0", patientConsent ? "text-green-600" : "text-muted-foreground")} />
                  <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer text-foreground">
                    План лечения и стоимость услуг разъяснены и согласованы с пациентом
                  </Label>
                </div>
              </div>
              {isApproved && existingPlan?.plan?.approved_at && (
                <div className="mt-3 ml-9 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                  Утверждён {format(new Date(existingPlan.plan.approved_at), "dd.MM.yyyy в HH:mm", { locale: ru })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== STICKY FOOTER ===== */}
        <div className="sticky bottom-0 z-20 bg-card/95 backdrop-blur-md border-t border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Summary */}
            {items.length > 0 && (
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Услуги</span>
                  <p className="font-medium text-foreground">{formatPrice(totals.subtotal)}</p>
                </div>
                {totals.discount > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Скидка</span>
                    <p className="font-medium text-green-600">−{formatPrice(totals.discount)}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs">К оплате</span>
                  <p className="text-xl font-bold text-primary">{formatPrice(totals.total)}</p>
                </div>
              </div>
            )}
            {items.length === 0 && <div />}

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
                Отмена
              </Button>

              {!isApproved && (
                <>
                  <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="border-border gap-2">
                    <Save className="w-4 h-4" />
                    Черновик
                  </Button>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button onClick={() => handleSave("approved")} disabled={saving || !patientConsent} className="gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {approving ? "Утверждение..." : "Утвердить план"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {patientConsent
                          ? "После утверждения план станет доступен пациенту (Ctrl+Enter)"
                          : "Подтвердите согласие пациента"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
