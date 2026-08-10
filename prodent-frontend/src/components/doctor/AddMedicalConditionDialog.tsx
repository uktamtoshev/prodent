import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from "react";

interface AddMedicalConditionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  doctorId: string | null;
  clinicId: string | null;
  /** "allergy" | "comorbidity" */
  kind: "allergy" | "comorbidity";
}

type Severity = "low" | "medium" | "high";

// PRESETS — used as DB-canonical strings when persisting recommendations.
// They're shown as quick-pick chips. Display labels are translated via t() at render.
const PRESETS: Record<string, string[]> = {
  allergy: [
    "Пенициллин",
    "Лидокаин",
    "Йод",
    "Латекс",
    "Анальгин",
    "Аспирин",
    "Сульфаниламиды",
  ],
  comorbidity: [
    "Сахарный диабет",
    "Гипертония",
    "Бронхиальная астма",
    "Сердечная недостаточность",
    "Беременность",
    "Заболевания печени",
    "Заболевания почек",
  ],
};

export function AddMedicalConditionDialog({
  open,
  onOpenChange,
  patientId,
  doctorId,
  clinicId,
  kind,
}: AddMedicalConditionDialogProps) {
  const { t } = useLanguage();
  const SEVERITY = useMemo<Array<{ v: Severity; l: string }>>(() => [
    { v: "low", l: t('doctorMedicalConditionDialog.severityMild') },
    { v: "medium", l: t('doctorMedicalConditionDialog.severityModerate') },
    { v: "high", l: t('doctorMedicalConditionDialog.severitySevere') },
  ], [t]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const queryClient = useQueryClient();

  const isAllergy = kind === "allergy";
  const headline = isAllergy ? t('doctorMedicalConditionDialog.title') : t('doctorMedicalConditionDialog.title');
  const placeholder = isAllergy
    ? t('doctorMedicalConditionDialog.conditionNamePlaceholder')
    : t('doctorMedicalConditionDialog.conditionNamePlaceholder');

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error(t('doctorMedicalConditionDialog.requiredField'));

      const { error } = await supabase.from("patient_recommendations").insert({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        recommendation_type: kind,
        title: title.trim(),
        description: description.trim() || `${headline.toLowerCase()}`,
        priority: severity,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('doctorMedicalConditionDialog.saved'));
      setTitle("");
      setDescription("");
      setSeverity("medium");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["medical-conditions", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patient-recommendations", patientId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t('doctorMedicalConditionDialog.saveError'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>
            {t('doctorMedicalConditionDialog.descriptionPlaceholder')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t('doctorMedicalConditionDialog.conditionName')}
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholder}
              className="w-full h-10 px-3 rounded-prodent-input border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-100))] focus:border-[hsl(var(--brand))]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS[kind].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTitle(p)}
                  className="h-7 px-2.5 inline-flex items-center gap-1 rounded-full bg-muted hover:bg-muted text-xs text-foreground"
                >
                  <Plus className="w-3 h-3" />
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t('doctorMedicalConditionDialog.notes')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('doctorMedicalConditionDialog.notesPlaceholder')}
              className="w-full min-h-[80px] px-3 py-2 rounded-prodent-input border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-100))] focus:border-[hsl(var(--brand))] resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t('doctorMedicalConditionDialog.severity')}
            </label>
            <div className="flex gap-2">
              {SEVERITY.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setSeverity(s.v)}
                  className={
                    "h-9 px-3 rounded-prodent-input text-sm font-medium border transition-colors " +
                    (severity === s.v
                      ? "bg-primary text-white border-[hsl(var(--brand))]"
                      : "bg-card border-border text-foreground hover:border-border")
                  }
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 inline-flex items-center justify-center gap-2 font-medium text-base rounded-prodent-btn border border-border bg-card text-foreground hover:bg-muted/50"
          >
            {t('doctorMedicalConditionDialog.cancel')}
          </button>
          <button
            type="button"
            disabled={createMutation.isPending || !title.trim()}
            onClick={() => createMutation.mutate()}
            className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-prodent-btn text-white font-semibold text-base disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: "hsl(var(--brand))",
              boxShadow:
                "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)",
            }}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('doctorMedicalConditionDialog.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
