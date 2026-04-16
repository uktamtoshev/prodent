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
import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  onSuccess: () => void;
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  clinicId,
  onSuccess,
}: AddPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [method, setMethod] = useState("cash");
  const [description, setDescription] = useState("");

  // Загружаем пациентов клиники
  const { data: patients } = useQuery({
    queryKey: ["clinic-patients", clinicId],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", clinicId)
        .eq("role", "patient");

      if (!members) return [];

      const patientIds = members.map((m) => m.user_id);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", patientIds);

      return data || [];
    },
    enabled: open && !!clinicId,
  });

  // Загружаем врачей клиники
  const { data: doctors } = useQuery({
    queryKey: ["clinic-doctors", clinicId],
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

  const handleSave = async () => {
    if (!patientId || !amount) {
      toast.error("Заполните обязательные поля");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("payments").insert({
        clinic_id: clinicId,
        user_id: patientId,
        doctor_id: doctorId || null,
        amount: Math.round(amountNum),
        currency,
        exchange_rate: 1.0,
        amount_converted: Math.round(amountNum),
        payment_method: method,
        status: "completed",
        description: description || null,
      } as any);

      if (error) throw error;

      // Создаём уведомление для пациента
      await supabase.from("notifications").insert({
        user_id: patientId,
        type: "payment",
        title: "Оплата получена",
        message: `Платёж на сумму ${amountNum.toLocaleString()} ${currency} успешно обработан`,
        metadata: { amount: amountNum, currency, method },
      } as any);

      toast.success("Оплата добавлена");
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error("Ошибка добавления оплаты: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setAmount("");
    setCurrency("UZS");
    setMethod("cash");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить оплату</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                  <SelectValue placeholder="Выберите врача (опционально)" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Сумма <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Валюта</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS - Узбекский сум</SelectItem>
                  <SelectItem value="USD">USD - Доллар США</SelectItem>
                  <SelectItem value="EUR">EUR - Евро</SelectItem>
                  <SelectItem value="RUB">RUB - Российский рубль</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Метод оплаты</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные</SelectItem>
                <SelectItem value="card">Банковская карта</SelectItem>
                <SelectItem value="online">Онлайн-платёж</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Сохранение..." : "Сохранить оплату"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
