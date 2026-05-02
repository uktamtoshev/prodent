import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Receipt, Wallet } from "lucide-react";

interface AddPaymentNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddPaymentNoteDialog({ open, onOpenChange, onSuccess }: AddPaymentNoteDialogProps) {
  const { user } = useAuth();
  const [type, setType] = useState<"payment" | "debt">("debt");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id || !amount) {
      toast.error("Введите сумму");
      return;
    }

    const amountNum = parseInt(amount.replace(/\D/g, ""));
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("patient_payment_notes")
        .insert({
          patient_id: user.id,
          type,
          amount: amountNum,
          description: description.trim() || null,
          clinic_name: clinicName.trim() || null,
          date,
        });

      if (error) throw error;

      toast.success(type === "debt" ? "Долг добавлен" : "Оплата добавлена");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setType("debt");
    setAmount("");
    setDescription("");
    setClinicName("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const formatAmount = (value: string) => {
    const num = value.replace(/\D/g, "");
    return num ? parseInt(num).toLocaleString("ru-RU") : "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Добавить запись
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Type Selection */}
          <div className="space-y-3">
            <Label>Тип записи</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "payment" | "debt")}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <RadioGroupItem value="debt" id="debt" className="peer sr-only" />
                <Label
                  htmlFor="debt"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-amber-500 peer-data-[state=checked]:bg-amber-500/10 cursor-pointer transition-all"
                >
                  <Receipt className="w-6 h-6 mb-2 text-amber-500" />
                  <span className="font-medium">Долг</span>
                  <span className="text-xs text-muted-foreground">Запомнить</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="payment" id="payment" className="peer sr-only" />
                <Label
                  htmlFor="payment"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                >
                  <Wallet className="w-6 h-6 mb-2 text-primary" />
                  <span className="font-medium">Оплата</span>
                  <span className="text-xs text-muted-foreground">Оплатил</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Сумма *</Label>
            <div className="relative">
              <Input
                id="amount"
                placeholder="100 000"
                value={formatAmount(amount)}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 text-lg font-semibold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                сум
              </span>
            </div>
          </div>

          {/* Clinic Name */}
          <div className="space-y-2">
            <Label htmlFor="clinic">Клиника / Врач</Label>
            <Input
              id="clinic"
              placeholder="Название клиники или имя врача"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Примечание</Label>
            <Textarea
              id="description"
              placeholder="За что платёж или долг..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1"
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !amount}
            className={`flex-1 ${type === "debt" ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-jade"} text-white`}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
