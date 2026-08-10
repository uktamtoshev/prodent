import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "./VoiceRecorder";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPatientMedicalRecords } from "@/lib/medical-record-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EligibleAppointment {
  id: string;
  clinic_id: string;
  appointment_date: string;
  start_time: string | null;
  service: string | null;
  status: string | null;
}

interface MedicalRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId: string;
  onSuccess: () => void;
}

export function MedicalRecordForm({
  open,
  onOpenChange,
  patientId,
  doctorId,
  onSuccess,
}: MedicalRecordFormProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [examination, setExamination] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState<Date>();
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const saveLockRef = useRef(false);
  const formContextRef = useRef(`${patientId}:${doctorId}`);

  useEffect(() => {
    const nextContext = `${patientId}:${doctorId}`;
    if (formContextRef.current === nextContext) return;
    formContextRef.current = nextContext;
    setChiefComplaint("");
    setExamination("");
    setDiagnosis("");
    setTreatment("");
    setRecommendations("");
    setNextVisitDate(undefined);
    setVoiceNotes([]);
    setSelectedAppointmentId("");
    setValidationAttempted(false);
  }, [doctorId, patientId]);

  const {
    data: eligibleAppointments = [],
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useQuery({
    queryKey: ["eligible-medical-record-appointments", patientId, doctorId],
    queryFn: async () => {
      const [appointmentResult, existingRecords] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, clinic_id, appointment_date, start_time, service, status")
          .eq("patient_id", patientId)
          .eq("doctor_id", doctorId)
          .in("status", ["CONFIRMED", "IN_PROGRESS", "COMPLETED"])
          .order("appointment_date", { ascending: false })
          .order("start_time", { ascending: false })
          .order("id", { ascending: false }),
        getPatientMedicalRecords(patientId),
      ]);

      if (appointmentResult.error) throw appointmentResult.error;

      const usedAppointmentIds = new Set(
        existingRecords
          .map((record) => record.appointmentId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      );

      return (appointmentResult.data || []).filter(
        (appointment): appointment is EligibleAppointment =>
          typeof appointment.id === "string" &&
          typeof appointment.clinic_id === "string" &&
          !usedAppointmentIds.has(appointment.id),
      );
    },
    enabled: open && !!patientId && !!doctorId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) {
      setSelectedAppointmentId("");
      return;
    }

    if (eligibleAppointments.length === 1) {
      setSelectedAppointmentId(eligibleAppointments[0].id);
      return;
    }

    if (!eligibleAppointments.some((appointment) => appointment.id === selectedAppointmentId)) {
      setSelectedAppointmentId("");
    }
  }, [eligibleAppointments, open, selectedAppointmentId]);

  const handleSave = async () => {
    if (saveLockRef.current) return;
    setValidationAttempted(true);
    if (!chiefComplaint.trim() || !diagnosis.trim()) {
      toast.error(t('crmMedicalRecordForm.requiredFields'));
      return;
    }

    const appointment = eligibleAppointments.find(
      (candidate) => candidate.id === selectedAppointmentId,
    );
    if (!appointment) {
      toast.error(t('crmMedicalRecordForm.appointmentRequired'));
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    try {
      const noteSections = [
        chiefComplaint && `Жалобы: ${chiefComplaint}`,
        examination && `Осмотр: ${examination}`,
        recommendations && `Рекомендации: ${recommendations}`,
        nextVisitDate && `Следующий визит: ${nextVisitDate.toISOString()}`,
        voiceNotes.length > 0 && `Голосовые заметки: ${voiceNotes.join(", ")}`,
      ].filter(Boolean);

      const { error } = await supabase.functions.invoke("create-medical-record", {
        body: {
          patientId,
          clinicId: appointment.clinic_id,
          appointmentId: appointment.id,
          diagnosis: diagnosis.trim(),
          treatment: treatment.trim(),
          notes: noteSections.join("\n\n") || null,
        },
      });
      if (error) throw new Error(error.message);

      toast.success(t('crmMedicalRecordForm.saveSuccess'));
      try {
        const refreshResult: unknown = await Promise.resolve(onSuccess());
        if (
          refreshResult &&
          typeof refreshResult === "object" &&
          (("isError" in refreshResult && refreshResult.isError === true) ||
            ("error" in refreshResult && refreshResult.error))
        ) {
          toast.warning(`${t('crmMedicalRecordForm.saveSuccess')}. ${t('common.error')}`);
        }
      } catch (refreshError) {
        console.error("Medical records refresh error:", refreshError);
        toast.warning(`${t('crmMedicalRecordForm.saveSuccess')}. ${t('common.error')}`);
      }
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('crmMedicalRecordForm.saveError')}: ${message}`);
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const resetForm = () => {
    setChiefComplaint("");
    setExamination("");
    setDiagnosis("");
    setTreatment("");
    setRecommendations("");
    setNextVisitDate(undefined);
    setVoiceNotes([]);
    setSelectedAppointmentId("");
    setValidationAttempted(false);
  };

  const handleVoiceNoteAdded = (url: string) => {
    setVoiceNotes([...voiceNotes, url]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>{t('crmMedicalRecordForm.newRecord')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="medical-record-appointment">{t('crmMedicalRecordForm.appointment')}</Label>
            {appointmentsLoading ? (
              <p className="text-sm text-muted-foreground">
                {t('crmMedicalRecordForm.appointmentsLoading')}
              </p>
            ) : appointmentsError ? (
              <p role="alert" className="text-sm text-status-danger">
                {t('crmMedicalRecordForm.appointmentsLoadError')}
              </p>
            ) : eligibleAppointments.length === 0 ? (
              <p role="status" className="rounded-md border border-status-warning/40 bg-status-warning-bg p-3 text-sm text-status-warning">
                {t('crmMedicalRecordForm.noEligibleAppointments')}
              </p>
            ) : (
              <Select
                value={selectedAppointmentId}
                onValueChange={setSelectedAppointmentId}
              >
                <SelectTrigger
                  id="medical-record-appointment"
                  className="min-h-11 border-border bg-background"
                  aria-invalid={validationAttempted && !selectedAppointmentId}
                >
                  <SelectValue placeholder={t('crmMedicalRecordForm.selectAppointment')} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAppointments.map((appointment) => (
                    <SelectItem key={appointment.id} value={appointment.id}>
                      {format(
                        new Date(
                          `${appointment.appointment_date}T${appointment.start_time || "00:00:00"}`,
                        ),
                        "d MMM yyyy, HH:mm",
                        { locale: ru },
                      )}
                      {appointment.service ? ` · ${appointment.service}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-complaint">
              {t('crmMedicalRecordForm.patientComplaints')} <span className="text-status-danger">*</span>
            </Label>
            <Textarea
              id="medical-record-complaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder={t('crmMedicalRecordForm.complaintsPlaceholder')}
              className="bg-background border-border"
              rows={3}
              aria-invalid={validationAttempted && !chiefComplaint.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-examination">{t('crmMedicalRecordForm.objectiveExam')}</Label>
            <Textarea
              id="medical-record-examination"
              value={examination}
              onChange={(e) => setExamination(e.target.value)}
              placeholder={t('crmMedicalRecordForm.examPlaceholder')}
              className="bg-background border-border"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-diagnosis">
              {t('crmMedicalRecordForm.diagnosis')} <span className="text-status-danger">*</span>
            </Label>
            <Textarea
              id="medical-record-diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder={t('crmMedicalRecordForm.diagnosisPlaceholder')}
              className="bg-background border-border"
              rows={2}
              aria-invalid={validationAttempted && !diagnosis.trim()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-treatment">{t('crmMedicalRecordForm.treatmentDone')}</Label>
            <Textarea
              id="medical-record-treatment"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder={t('crmMedicalRecordForm.treatmentPlaceholder')}
              className="bg-background border-border"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical-record-recommendations">{t('crmMedicalRecordForm.recommendations')}</Label>
            <Textarea
              id="medical-record-recommendations"
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder={t('crmMedicalRecordForm.recommendationsPlaceholder')}
              className="bg-background border-border"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('crmMedicalRecordForm.nextVisit')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "min-h-11 w-full justify-start text-left font-normal bg-background border-border",
                    !nextVisitDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextVisitDate ? format(nextVisitDate, "PPP", { locale: ru }) : t('crmMedicalRecordForm.pickDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                <Calendar
                  mode="single"
                  selected={nextVisitDate}
                  onSelect={setNextVisitDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('crmMedicalRecordForm.voiceNotes')}</Label>
            <VoiceRecorder patientId={patientId} onVoiceNoteAdded={handleVoiceNoteAdded} />
            {voiceNotes.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {t('crmMedicalRecordForm.voiceNotesAdded')}: {voiceNotes.length}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-11 border-border"
              disabled={saving}
            >
              {t('crmMedicalRecordForm.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              className="min-h-11"
              disabled={
                saving ||
                appointmentsLoading ||
                appointmentsError ||
                !selectedAppointmentId
              }
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? t('crmMedicalRecordForm.saving') : t('crmMedicalRecordForm.saveRecord')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
