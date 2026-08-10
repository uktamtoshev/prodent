import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Search, UserRound } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TreatmentPlanDto } from "@/lib/treatment-plans-api";
import { TreatmentPlanForm } from "./TreatmentPlanForm";
import { loadEligiblePatients } from "./treatmentPlanPatientEligibility";

export interface DoctorPlanClinicOption {
  id: string;
  name: string;
}

interface DoctorTreatmentPlanCreateFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  clinics: DoctorPlanClinicOption[];
  initialClinicId?: string | null;
  initialPatient?: {
    id: string;
    fullName: string;
    phone: string | null;
  } | null;
  onSuccess?: (plan: TreatmentPlanDto) => void;
}

export function DoctorTreatmentPlanCreateFlow({
  open,
  onOpenChange,
  doctorId,
  clinics,
  initialClinicId,
  initialPatient,
  onSuccess,
}: DoctorTreatmentPlanCreateFlowProps) {
  const { t } = useLanguage();
  const wasOpen = useRef(false);
  const [step, setStep] = useState<"selection" | "form">("selection");
  const [clinicId, setClinicId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const preferredClinic = clinics.find((clinic) => clinic.id === initialClinicId)
        ?? clinics[0];
      setClinicId(preferredClinic?.id || "");
      setPatientId(initialPatient?.id || "");
      setSearch("");
      setDeferredSearch("");
      setPage(0);
      setStep(initialPatient?.id ? "form" : "selection");
    }
    wasOpen.current = open;
  }, [open, clinics, initialClinicId, initialPatient?.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDeferredSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const {
    data: patientPage,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "doctor-treatment-plan-patients",
      doctorId,
      clinicId,
      deferredSearch,
      page,
    ],
    queryFn: ({ signal }) => loadEligiblePatients(
      clinicId,
      deferredSearch,
      page,
      50,
      signal,
    ),
    enabled: open && step === "selection" && !!doctorId && !!clinicId,
  });
  const patients = patientPage?.content ?? [];

  const closeFlow = () => {
    setStep("selection");
    setPatientId("");
    setSearch("");
    setDeferredSearch("");
    setPage(0);
    onOpenChange(false);
  };

  const handleClinicChange = (value: string) => {
    setClinicId(value);
    setPatientId("");
    setSearch("");
    setDeferredSearch("");
    setPage(0);
  };

  if (step === "form" && clinicId && patientId) {
    return (
      <TreatmentPlanForm
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeFlow();
        }}
        patientId={patientId}
        doctorId={doctorId}
        clinicId={clinicId}
        planPathPrefix="/doctor/treatment-plans"
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeFlow();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("doctorTreatmentPlans.newPlan")}</DialogTitle>
          <DialogDescription>
            {t("crmTreatmentDialogs.selectPatient")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="treatment-plan-clinic">
              {t("crmTreatmentDialogs.hospitalName")}
            </Label>
            <Select value={clinicId} onValueChange={handleClinicChange}>
              <SelectTrigger id="treatment-plan-clinic">
                <SelectValue placeholder={t("crmTreatmentForm.clinicNotSelected")} />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment-plan-patient-search">
              {t("doctorTreatmentPlans.patient")}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="treatment-plan-patient-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPatientId("");
                  setPage(0);
                }}
                placeholder={t("doctorMessages.searchPatient")}
                className="pl-9"
                disabled={!clinicId || isLoading || isError}
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-panel border border-border bg-background p-1">
              {!clinicId ? (
                <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {t("crmTreatmentForm.clinicNotSelected")}
                </div>
              ) : isLoading ? (
                <div className="flex min-h-28 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="flex min-h-28 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-destructive">
                  <span>{t("common.error")}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                    {t("treatmentPlanPublic.retry")}
                  </Button>
                </div>
              ) : patients.length === 0 ? (
                <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {t("doctorPatients.patientsNotFound")}
                </div>
              ) : (
                <div className="space-y-1">
                  {patients.map((patient) => {
                    const selected = patient.id === patientId;
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPatientId(patient.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/70",
                        )}
                      >
                        <span className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}>
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {patient.fullName || t("doctorTreatmentPlans.patient")}
                          </span>
                          {patient.phone && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {patient.phone}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {(page > 0 || patientPage?.hasNext) && (
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || isLoading}
                  onClick={() => {
                    setPatientId("");
                    setPage((current) => Math.max(0, current - 1));
                  }}
                >
                  {t("common.back")}
                </Button>
                <span className="text-xs text-muted-foreground">{page + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!patientPage?.hasNext || isLoading}
                  onClick={() => {
                    setPatientId("");
                    setPage((current) => current + 1);
                  }}
                >
                  {t("common.next")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeFlow}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!doctorId || !clinicId || !patientId}
            onClick={() => setStep("form")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            {t("common.next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
