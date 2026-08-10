import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DentalChartProps {
  patientId: string;
}

export function DentalChart({ patientId }: DentalChartProps) {
  const { t } = useLanguage();
  /**
   * Tooth states.
   *
   * The colours used to be Tailwind's `*-400` shades on a `*-500/20` tint —
   * shades built for a DARK background, painted on a white card. The FDI number
   * measured 1.44-1.59:1 against its own tile, so the one piece of information
   * that identifies the tooth was the least readable thing on the chart. "13
   * instead of 23" means treating the wrong tooth, so this is a safety issue,
   * not a styling preference.
   *
   * Now: `--tooth-*` token pairs (>= 4.5:1 in both themes, asserted in
   * design-tokens-contrast.contract.test.ts) plus a `code` — the short Latin
   * mark used on paper odontograms. The code is what makes the state readable
   * without colour (WCAG 1.4.1) and it works the same in all six languages,
   * unlike a translated word. `healthy` carries no code on purpose: most teeth
   * are healthy, and marking all 32 would be noise instead of signal.
   */
  const TOOTH_STATUS = useMemo(() => ({
    healthy: {
      label: t('crmDentalChart.statusHealthy'),
      code: "",
      color: "bg-tooth-healthy-bg border-tooth-healthy text-tooth-healthy",
    },
    caries: {
      label: t('crmDentalChart.statusCariesShort'),
      code: "C",
      color: "bg-tooth-caries-bg border-tooth-caries text-tooth-caries",
    },
    filling: {
      label: t('crmDentalChart.statusFillingShort'),
      code: "F",
      color: "bg-tooth-filling-bg border-tooth-filling text-tooth-filling",
    },
    crown: {
      label: t('crmDentalChart.statusCrownShort'),
      code: "Cr",
      color: "bg-tooth-crown-bg border-tooth-crown text-tooth-crown",
    },
    implant: {
      label: t('crmDentalChart.statusImplantShort'),
      code: "Im",
      color: "bg-tooth-implant-bg border-tooth-implant text-tooth-implant",
    },
    removed: {
      label: t('crmDentalChart.statusRemoved'),
      code: "X",
      // Struck through, never faded: opacity would drop the contrast of the
      // number below any readable level.
      color: "bg-tooth-removed-bg border-tooth-removed text-tooth-removed line-through",
    },
  }), [t]);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("healthy");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Загружаем clinic_id
  const { data: clinicData } = useQuery({
    queryKey: ["user-clinic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();
      return data;
    },
  });

  // Загружаем данные зубной формулы
  const { data: dentalData } = useQuery({
    queryKey: ["dental-chart", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dental_chart")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicData?.clinic_id);
      return data || [];
    },
    enabled: !!clinicData?.clinic_id,
  });

  // Мутация для сохранения данных
  const saveMutation = useMutation({
    mutationFn: async (toothNumber: number) => {
      if (!clinicData?.clinic_id) throw new Error("Clinic ID not found");
      
      const existing = dentalData?.find((d) => d.tooth_number === toothNumber);

      if (existing) {
        const { error } = await supabase
          .from("dental_chart")
          .update({ status, diagnosis, notes })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dental_chart")
          .insert({ 
            patient_id: patientId, 
            tooth_number: toothNumber, 
            status, 
            diagnosis, 
            notes,
            clinic_id: clinicData.clinic_id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dental-chart", patientId] });
      toast.success(t('crmDentalChart.toothSaved'));
      setSelectedTooth(null);
    },
    onError: () => {
      toast.error(t('crmDentalChart.toothSaveError'));
    },
  });

  const handleToothClick = (toothNumber: number) => {
    const toothData = dentalData?.find((d) => d.tooth_number === toothNumber);
    setSelectedTooth(toothNumber);
    setStatus(toothData?.status || "healthy");
    setDiagnosis(toothData?.diagnosis || "");
    setNotes(toothData?.notes || "");
  };

  const handleSave = () => {
    if (selectedTooth) {
      saveMutation.mutate(selectedTooth);
    }
  };


  const renderTooth = (toothNumber: number) => {
    const toothData = dentalData?.find((d) => d.tooth_number === toothNumber);
    const statusKey = (toothData?.status || "healthy") as keyof typeof TOOTH_STATUS;
    const statusInfo = TOOTH_STATUS[statusKey] || TOOTH_STATUS.healthy;
    
    return (
      <TooltipProvider key={toothNumber}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleToothClick(toothNumber)}
              // The state is announced, not just shown, and the label reads the
              // same on a tablet at the chair where no tooltip ever opens.
              aria-label={`${t('crmDentalChart.tooltipNumber')}${toothNumber}, ${statusInfo.label}`}
              className={`flex h-16 w-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-sm font-semibold tabular-nums transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${statusInfo.color}`}
            >
              <span>{toothNumber}</span>
              {/* Visible state mark — the chart stays readable in greyscale and
                  for a colour-blind dentist. */}
              {statusInfo.code ? (
                <span aria-hidden="true" className="text-xs font-bold leading-none no-underline">
                  {statusInfo.code}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-semibold">{t('crmDentalChart.tooltipNumber')}{toothNumber}</div>
              <div>{t('crmDentalChart.tooltipStatus')} {statusInfo.label}</div>
              {toothData?.diagnosis && <div className="text-xs text-muted-foreground">{toothData.diagnosis}</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Верхняя челюсть: 18-11 (справа налево), 21-28 (слева направо)
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  
  // Нижняя челюсть: 48-41 (справа налево), 31-38 (слева направо)
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
  const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

  return (
    <>
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">{t('crmDentalChart.formulaTitle')}</CardTitle>
          <p className="text-muted-foreground text-sm">{t('crmDentalChart.formulaHint')}</p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Верхняя челюсть */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm text-center">{t('crmDentalChart.upperJaw')}</div>
            <div className="flex justify-center gap-1">
              <div className="flex gap-1">{upperRight.map(renderTooth)}</div>
              <div className="w-4" />
              <div className="flex gap-1">{upperLeft.map(renderTooth)}</div>
            </div>
          </div>

          {/* Нижняя челюсть */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm text-center">{t('crmDentalChart.lowerJaw')}</div>
            <div className="flex justify-center gap-1">
              <div className="flex gap-1">{lowerRight.map(renderTooth)}</div>
              <div className="w-4" />
              <div className="flex gap-1">{lowerLeft.map(renderTooth)}</div>
            </div>
          </div>

          {/* Легенда */}
          {/* Legend shows the mark next to the colour — otherwise the codes on
              the tiles would be an undocumented private language. */}
          <div className="flex flex-wrap justify-center gap-4 border-t border-border pt-4">
            {Object.entries(TOOTH_STATUS).map(([key, { label, code, color }]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 place-items-center rounded border-2 text-xs font-bold no-underline ${color}`}
                >
                  {code}
                </span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Диалог редактирования зуба */}
      <Dialog open={selectedTooth !== null} onOpenChange={() => setSelectedTooth(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('crmDentalChart.toothLabel')}{selectedTooth}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label id="tooth-status-label" className="text-foreground">{t('crmDentalChart.statusLabel')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-labelledby="tooth-status-label" className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(TOOTH_STATUS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tooth-diagnosis" className="text-foreground">{t('crmDentalChart.diagnosisLabel')}</Label>
              <Textarea
                id="tooth-diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder={t('crmDentalChart.diagnosisPh')}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tooth-notes" className="text-foreground">{t('crmDentalChart.notesLabel')}</Label>
              <Textarea
                id="tooth-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('crmDentalChart.notesPh')}
                className="bg-background border-border"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedTooth(null)}>
                {t('crmDentalChart.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('crmDentalChart.saving') : t('crmDentalChart.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
