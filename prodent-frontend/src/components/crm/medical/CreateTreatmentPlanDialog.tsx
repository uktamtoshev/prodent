import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Smile } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface CreateTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId: string;
  clinicId: string;
}

interface PlanItem {
  tooth_number: string;
  category: string;
  service_id: string;
  quantity: string;
  notes: string;
  is_general: boolean;
}

export function CreateTreatmentPlanDialog({
  open,
  onOpenChange,
  patientId,
  doctorId,
  clinicId,
}: CreateTreatmentPlanDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validDays, setValidDays] = useState("30");
  const [items, setItems] = useState<PlanItem[]>([]);

  const { data: services } = useQuery({
    queryKey: ["clinic-services", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, category, price")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("category")
        .order("name");
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const categories = useMemo(() => {
    if (!services) return [];
    return [...new Set(services.map((s) => s.category).filter(Boolean))].sort();
  }, [services]);

  const getServicesByCategory = (category: string) => {
    if (!services || !category) return [];
    return services.filter((s) => s.category === category);
  };

  const getServicePrice = (serviceId: string) => {
    return services?.find((s) => s.id === serviceId)?.price || 0;
  };

  const getServiceName = (serviceId: string) => {
    return services?.find((s) => s.id === serviceId)?.name || "";
  };

  const addToothItem = () => {
    setItems([...items, { tooth_number: "", category: "", service_id: "", quantity: "1", notes: "", is_general: false }]);
  };

  const addGeneralItem = () => {
    setItems([...items, { tooth_number: "", category: "", service_id: "", quantity: "1", notes: "", is_general: true }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PlanItem, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "category") {
      newItems[index].service_id = "";
    }
    setItems(newItems);
  };

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = getServicePrice(item.service_id);
      const qty = parseInt(item.quantity) || 1;
      return sum + price * qty;
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, services]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Введите название плана");
      return;
    }
    const validItems = items.filter((item) => item.service_id);
    if (validItems.length === 0) {
      toast.error("Добавьте хотя бы одну услугу");
      return;
    }
    setSaving(true);
    try {
      const days = parseInt(validDays) || 30;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + days);

      const { data: plan, error: planError } = await supabase
        .from("treatment_plans")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: doctorId,
          name,
          description,
          status: "draft",
          valid_days: days,
          valid_until: validUntil.toISOString(),
        } as any)
        .select()
        .single();
      if (planError) throw planError;

      const planItems = validItems.map((item) => ({
        clinic_id: clinicId,
        plan_id: plan.id,
        procedure: getServiceName(item.service_id),
        service_id: item.service_id,
        tooth_number: item.tooth_number ? parseInt(item.tooth_number) : null,
        price: getServicePrice(item.service_id),
        quantity: parseInt(item.quantity) || 1,
        notes: item.notes || null,
        status: "planned",
      }));

      const { error: itemsError } = await supabase
        .from("treatment_plan_items")
        .insert(planItems as any);
      if (itemsError) throw itemsError;

      toast.success("План лечения создан");
      queryClient.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error("Ошибка создания плана: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setValidDays("30");
    setItems([]);
  };

  const TOOTH_NUMBERS = Array.from({ length: 32 }, (_, i) => {
    const quadrant = Math.floor(i / 8) + 1;
    const tooth = (i % 8) + 1;
    return `${quadrant}${tooth}`;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold">Создать план лечения</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Plan name & description */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Название плана *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Комплексное лечение"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Этап</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: Этап 1 — Терапия"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Срок действия (дней)</Label>
              <Input
                type="number"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                placeholder="30"
                min="1"
                max="365"
                className="h-10"
              />
            </div>
          </div>

          {/* Services section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="text-base">📋</span>
                Услуги и процедуры
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addToothItem}
                  className="h-8 text-xs border-primary text-primary hover:bg-primary/5"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  На зуб
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addGeneralItem}
                  className="h-8 text-xs border-primary text-primary hover:bg-primary/5"
                >
                  <Smile className="w-3.5 h-3.5 mr-1" />
                  Общая процедура
                </Button>
              </div>
            </div>

            {/* Table header */}
            {items.length > 0 && (
              <div className="grid grid-cols-[40px_70px_1fr_70px_100px_100px_32px] gap-2 px-3 text-xs text-muted-foreground font-medium">
                <span>№</span>
                <span>Тип</span>
                <span>Услуга</span>
                <span>Кол-во</span>
                <span>Цена</span>
                <span className="text-right">Итого</span>
                <span></span>
              </div>
            )}

            {/* Rows */}
            <div className="space-y-2">
              {items.map((item, index) => {
                const filteredServices = item.category ? getServicesByCategory(item.category) : (services || []);
                const price = getServicePrice(item.service_id);
                const qty = parseInt(item.quantity) || 1;
                const rowTotal = price * qty;

                return (
                  <div
                    key={index}
                    className="grid grid-cols-[40px_70px_1fr_70px_100px_100px_32px] gap-2 items-center px-3 py-2.5 rounded-lg border border-border bg-muted/30"
                  >
                    {/* Row number */}
                    <span className="text-sm text-muted-foreground font-medium">{index + 1}</span>

                    {/* Tooth number or General */}
                    {item.is_general ? (
                      <span className="text-xs text-muted-foreground text-center">—</span>
                    ) : (
                      <Select
                        value={item.tooth_number}
                        onValueChange={(v) => updateItem(index, "tooth_number", v)}
                      >
                        <SelectTrigger className="h-8 text-xs px-2">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          {TOOTH_NUMBERS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Service (combined category + service) */}
                    <div className="flex gap-1.5">
                      <Select
                        value={item.category}
                        onValueChange={(v) => updateItem(index, "category", v)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[120px] shrink-0">
                          <SelectValue placeholder="Категория" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={item.service_id}
                        onValueChange={(v) => updateItem(index, "service_id", v)}
                        disabled={!item.category}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder={item.category ? "Выберите услугу" : "—"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredServices.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity */}
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      min="1"
                      className="h-8 text-xs text-center px-1"
                    />

                    {/* Price */}
                    <div className="text-sm text-muted-foreground text-right">
                      {price > 0 ? `${price.toLocaleString()}` : "0"} <span className="text-xs">UZS</span>
                    </div>

                    {/* Total */}
                    <div className="text-sm font-medium text-foreground text-right">
                      {rowTotal > 0 ? `${rowTotal.toLocaleString()}` : "0"} <span className="text-xs text-muted-foreground">UZS</span>
                    </div>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-8 w-8 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                Нажмите «На зуб» или «Общая процедура» чтобы добавить услугу
              </div>
            )}
          </div>

          {/* Total */}
          {totalPrice > 0 && (
            <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-medium text-muted-foreground">Итого:</span>
              <span className="text-lg font-bold text-foreground">{totalPrice.toLocaleString()} UZS</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving} className="h-9">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Сохранение..." : "Создать план"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
