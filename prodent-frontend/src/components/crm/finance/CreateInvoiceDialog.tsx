import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

interface InvoiceItem {
  service: string;
  price: string;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  clinicId,
}: CreateInvoiceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ service: "", price: "" }]);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user?.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: patients } = useQuery({
    queryKey: ["clinic-patients-for-invoice", clinicId],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", clinicId);

      if (!members) return [];

      const patientIds = members.map((m) => m.user_id);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", patientIds);

      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const { data: doctors } = useQuery({
    queryKey: ["clinic-doctors-for-invoice", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          user:profiles!doctors_user_id_fkey(full_name)
        `)
        .eq("clinic_id", clinicId);

      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const addItem = () => {
    setItems([...items, { service: "", price: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const totalAmount = items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      return sum + price;
    }, 0);

    let finalAmount = totalAmount;

    if (discountPercent) {
      const percent = parseFloat(discountPercent);
      finalAmount = totalAmount * (1 - percent / 100);
    } else if (discountAmount) {
      const discount = parseFloat(discountAmount);
      finalAmount = totalAmount - discount;
    }

    return {
      totalAmount: Math.round(totalAmount),
      finalAmount: Math.round(Math.max(0, finalAmount)),
      discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
      discountAmount: discountAmount ? parseFloat(discountAmount) : 0,
    };
  };

  const handleSave = async () => {
    if (!patientId) {
      toast.error("Выберите пациента");
      return;
    }

    const validItems = items.filter((item) => item.service.trim() && item.price);
    if (validItems.length === 0) {
      toast.error("Добавьте хотя бы одну услугу");
      return;
    }

    const totals = calculateTotals();

    setSaving(true);
    try {
      const { error } = await supabase.from("invoices").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        doctor_id: doctorId || currentDoctor?.id || null,
        total_amount: totals.totalAmount,
        discount_percent: totals.discountPercent,
        discount_amount: totals.discountAmount,
        final_amount: totals.finalAmount,
        status: "new",
        notes: notes || null,
      } as any);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: patientId,
        type: "invoice",
        title: "Новый счёт",
        message: `Выставлен счёт на сумму ${totals.finalAmount.toLocaleString()} UZS`,
        metadata: { amount: totals.finalAmount },
      } as any);

      toast.success("Счёт создан");
      queryClient.invalidateQueries({ queryKey: ["invoices-list"] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error("Ошибка создания счёта: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setItems([{ service: "", price: "" }]);
    setDiscountPercent("");
    setDiscountAmount("");
    setNotes("");
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать счёт</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Пациент <span className="text-destructive">*</span>
              </Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пациента" />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name || "Без имени"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Врач</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите врача" />
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {(doctor.user as any)?.full_name || "Без имени"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Услуги</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-end gap-2 p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm">Услуга</Label>
                    <Input
                      value={item.service}
                      onChange={(e) => updateItem(index, "service", e.target.value)}
                      placeholder="Название услуги"
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label className="text-sm">Цена</Label>
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItem(index, "price", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Скидка %</Label>
              <Input
                type="number"
                value={discountPercent}
                onChange={(e) => {
                  setDiscountPercent(e.target.value);
                  setDiscountAmount("");
                }}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Скидка сумма (UZS)</Label>
              <Input
                type="number"
                value={discountAmount}
                onChange={(e) => {
                  setDiscountAmount(e.target.value);
                  setDiscountPercent("");
                }}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Примечания</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация..."
              rows={2}
            />
          </div>

          <div className="p-4 bg-muted rounded-lg border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Сумма услуг:</span>
              <span className="font-medium">
                {totals.totalAmount.toLocaleString()} UZS
              </span>
            </div>
            {(discountPercent || discountAmount) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Скидка:</span>
                <span className="text-destructive font-medium">
                  -{(totals.totalAmount - totals.finalAmount).toLocaleString()} UZS
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span>Итого:</span>
              <span className="text-primary">{totals.finalAmount.toLocaleString()} UZS</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Сохранение..." : "Создать счёт"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
