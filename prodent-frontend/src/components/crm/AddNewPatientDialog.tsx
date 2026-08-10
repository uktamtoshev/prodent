import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { addClinicMember } from "@/lib/clinic-members-api";

interface AddNewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  last_name: string;
  first_name: string;
  middle_name: string;
  phone: string;
  email: string;
  gender: "" | "male" | "female";
  date_of_birth: string; // YYYY-MM-DD
}

const empty: FormState = {
  last_name: "",
  first_name: "",
  middle_name: "",
  phone: "+998",
  email: "",
  gender: "",
  date_of_birth: "",
};

// Uzbekistan phone: +998 followed by 9 digits
const phoneRe = /^\+998\d{9}$/;

export function AddNewPatientDialog({ open, onOpenChange }: AddNewPatientDialogProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (!open) setForm(empty);
  }, [open]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const createPatient = useMutation({
    mutationFn: async () => {
      // Resolve clinic id — fall back to a doctor-lookup if context hasn't populated
      let clinicId = currentClinic?.id;
      if (!clinicId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: doc } = await supabase
            .from("doctors")
            .select("clinic_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (doc?.clinic_id) clinicId = doc.clinic_id;
        }
      }
      if (!clinicId) throw new Error(t('crmAddNewPatient.errClinicNotSelected'));

      // Validate
      if (!form.last_name.trim() || !form.first_name.trim()) {
        throw new Error(t('crmAddNewPatient.errSpecifyName'));
      }
      if (!phoneRe.test(form.phone.trim())) {
        throw new Error(t('crmAddNewPatient.errPhoneFormat'));
      }

      // 1. Create user via the profiles VIEW (insert trigger writes into users).
      // We deliberately omit `full_name` because the trigger derives first/last
      // from full_name via split-on-space (Western order), which corrupts
      // Russian "Фамилия Имя" inputs. Sending first_name + last_name explicitly
      // makes the trigger keep them as-is.
      const profilePayload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
      };
      if (form.middle_name.trim()) profilePayload.middle_name = form.middle_name.trim();
      if (form.email.trim()) profilePayload.email = form.email.trim();
      if (form.gender) profilePayload.gender = form.gender.toUpperCase();
      if (form.date_of_birth) profilePayload.date_of_birth = form.date_of_birth;

      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .insert(profilePayload)
        .select("id")
        .single();
      if (createErr) {
        const msg = (createErr.message || "").toLowerCase();
        if (msg.includes("phone") && msg.includes("unique")) {
          throw new Error(t('crmAddNewPatient.errPhoneExists'));
        }
        if (msg.includes("email") && msg.includes("unique")) {
          throw new Error(t('crmAddNewPatient.errEmailExists'));
        }
        throw new Error(createErr.message || t('crmAddNewPatient.errCreatePatient'));
      }
      const newUserId = created?.id;
      if (!newUserId) throw new Error(t('crmAddNewPatient.errNoUserId'));

      // 2. Link to the clinic as a patient member
      await addClinicMember({
        clinicId,
        userId: newUserId,
        role: "patient",
      });

      return newUserId;
    },
    onSuccess: () => {
      toast.success(t('crmAddNewPatient.patientAdded'));
      qc.invalidateQueries({ queryKey: ["clinic-patients"] });
      qc.invalidateQueries({ queryKey: ["personal-patients"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      console.error("Create patient error:", e);
      toast.error(e.message || t('crmAddNewPatient.errCreatePatient'));
    },
  });

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    phoneRe.test(form.phone.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('crmAddNewPatient.newPatient')}
          </DialogTitle>
          <DialogDescription>
            {t('crmAddNewPatient.fillDataDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-new-patient-dialog-field-1">{t('crmAddNewPatient.lastName')} *</Label>
              <Input id="add-new-patient-dialog-field-1"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                placeholder={t('crmAddNewPatient.lastNamePh')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-new-patient-dialog-field-2">{t('crmAddNewPatient.firstName')} *</Label>
              <Input id="add-new-patient-dialog-field-2"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                placeholder={t('crmAddNewPatient.firstNamePh')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-new-patient-dialog-field-3">{t('crmAddNewPatient.middleName')}</Label>
            <Input id="add-new-patient-dialog-field-3"
              value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)}
              placeholder={t('crmAddNewPatient.middleNamePh')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-new-patient-dialog-field-4">{t('crmAddNewPatient.phone')} *</Label>
              <Input id="add-new-patient-dialog-field-4"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+998901234567"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-new-patient-dialog-field-5">Email</Label>
              <Input id="add-new-patient-dialog-field-5"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="ivan@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('crmAddNewPatient.gender')}</Label>
              <Select
                value={form.gender || undefined}
                onValueChange={(v) => update("gender", v as FormState["gender"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('crmAddNewPatient.notSpecified')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('crmAddNewPatient.male')}</SelectItem>
                  <SelectItem value="female">{t('crmAddNewPatient.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-new-patient-dialog-field-6">{t('crmAddNewPatient.dateOfBirth')}</Label>
              <Input id="add-new-patient-dialog-field-6"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => update("date_of_birth", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              {t('crmAddNewPatient.cancel')}
            </Button>
            <Button
              onClick={() => createPatient.mutate()}
              disabled={!canSubmit || createPatient.isPending}
              className="flex-1"
            >
              {createPatient.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {t('crmAddNewPatient.add')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
