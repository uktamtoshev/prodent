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
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type ProfileSummary = { full_name: string | null };
type ClinicDoctor = {
  id: string;
  user: ProfileSummary | ProfileSummary[] | null;
};

const getProfileName = (profile: ProfileSummary | ProfileSummary[] | null | undefined) =>
  Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
  const { t } = useLanguage();
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
      toast.error(t('crmFinanceComponents.fillRequiredFields'));
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('crmFinanceComponents.enterValidAmount'));
      return;
    }

    setSaving(true);
    try {
      const payment: PaymentInsert = {
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
      };

      const { error } = await supabase.from("payments").insert(payment);

      if (error) throw error;

      // Create notification for patient
      const notification: NotificationInsert = {
        user_id: patientId,
        type: "payment",
        title: t('crmFinanceComponents.notifPaymentReceivedTitle'),
        message: `${t('crmFinanceComponents.notifPaymentReceivedMsgPrefix')} ${amountNum.toLocaleString()} ${currency} ${t('crmFinanceComponents.notifPaymentReceivedMsgSuffix')}`,
        metadata: { amount: amountNum, currency, method },
      };

      await supabase.from("notifications").insert(notification);

      toast.success(t('crmFinanceComponents.paymentAdded'));
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(t('crmFinanceComponents.paymentAddError') + ": " + getErrorMessage(error));
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
          <DialogTitle>{t('crmFinanceComponents.addPayment')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {t('crmFinanceComponents.colPatient')} <span className="text-destructive">*</span>
              </Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('crmFinanceComponents.selectPatient')} />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name || t('crmFinanceComponents.noName')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('crmFinanceComponents.doctor')}</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('crmFinanceComponents.selectDoctorOptional')} />
                </SelectTrigger>
                <SelectContent>
                  {(doctors as ClinicDoctor[] | undefined)?.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {getProfileName(doctor.user) || t('crmFinanceComponents.noName')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-payment-dialog-field-1">
                {t('crmFinanceComponents.colAmount')} <span className="text-destructive">*</span>
              </Label>
              <Input id="add-payment-dialog-field-1"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('crmFinanceComponents.currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS - {t('crmFinanceComponents.currencyUZS')}</SelectItem>
                  <SelectItem value="USD">USD - {t('crmFinanceComponents.currencyUSD')}</SelectItem>
                  <SelectItem value="EUR">EUR - {t('crmFinanceComponents.currencyEUR')}</SelectItem>
                  <SelectItem value="RUB">RUB - {t('crmFinanceComponents.currencyRUB')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('crmFinanceComponents.paymentMethod')}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('crmFinanceComponents.methodCash')}</SelectItem>
                <SelectItem value="card">{t('crmFinanceComponents.methodCard')}</SelectItem>
                <SelectItem value="online">{t('crmFinanceComponents.methodOnline')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-payment-dialog-field-2">{t('crmFinanceComponents.comment')}</Label>
            <Textarea id="add-payment-dialog-field-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('crmFinanceComponents.additionalInfo')}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('crmFinanceComponents.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? t('crmFinanceComponents.saving') : t('crmFinanceComponents.savePayment')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
