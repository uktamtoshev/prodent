import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRequestMedicalAccess, AccessReason, AccessDuration } from "@/hooks/useMedicalAccess";
import { Shield, Clock, FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  clinicId?: string;
  source: 'search' | 'chat';
  defaultReason?: AccessReason;
}

export function RequestAccessDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  doctorId,
  clinicId,
  source,
  defaultReason = 'consultation'
}: RequestAccessDialogProps) {
  const { t } = useLanguage();

  const REASONS: { value: AccessReason; label: string }[] = [
    { value: 'consultation', label: t('medicalAccess.reasonConsultation') },
    { value: 'diagnosis', label: t('medicalAccess.reasonDiagnosis') },
    { value: 'second_opinion', label: t('medicalAccess.reasonSecondOpinion') },
    { value: 'treatment', label: t('medicalAccess.reasonTreatment') },
  ];

  const DURATIONS: { value: AccessDuration; hours: number; label: string }[] = [
    { value: '24h', hours: 24, label: t('medicalAccess.duration24h') },
    { value: '72h', hours: 72, label: t('medicalAccess.duration72h') },
    { value: '7d', hours: 168, label: t('medicalAccess.duration7d') },
  ];

  const [reason, setReason] = useState<AccessReason>(defaultReason);
  const [duration, setDuration] = useState<AccessDuration>('24h');

  const requestAccess = useRequestMedicalAccess();

  const handleSubmit = async () => {
    const durationHours = DURATIONS.find(d => d.value === duration)?.hours || 24;
    const reasonLabel = REASONS.find(r => r.value === reason)?.label || reason;

    await requestAccess.mutateAsync({
      patientId,
      doctorId,
      clinicId,
      source,
      reason: reasonLabel,
      durationHours
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{t('medicalAccess.requestAccessTitle')}</DialogTitle>
          </div>
          <DialogDescription>
            {patientName
              ? t('medicalAccess.requestAccessForPatient').replace('{name}', patientName)
              : t('medicalAccess.requestAccessGeneric')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t('medicalAccess.reasonLabel')}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as AccessReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('medicalAccess.durationField')}
            </Label>
            <Select value={duration} onValueChange={(v) => setDuration(v as AccessDuration)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>
              {t('medicalAccess.afterPatientApproval')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={requestAccess.isPending}>
            {requestAccess.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('medicalAccess.sendRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
