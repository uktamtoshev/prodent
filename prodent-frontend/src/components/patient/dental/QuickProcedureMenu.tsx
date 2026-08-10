import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Stethoscope, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTreatmentPlan } from "@/lib/treatment-plans-api";
import {
  loadActiveClinicServiceOptions,
  type ClinicServiceOption,
} from "@/lib/clinic-services";

interface QuickProcedureMenuProps {
  patientId: string;
  toothNumber: number;
  doctorId?: string;
  onProcedureAdded?: () => void;
}

export function QuickProcedureMenu({
  patientId,
  toothNumber,
  doctorId,
  onProcedureAdded
}: QuickProcedureMenuProps) {
  const { t, language } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [patientConsentConfirmed, setPatientConsentConfirmed] = useState(false);
  const consentId = useId();

  // Fetch clinic services
  const { data: services } = useQuery<ClinicServiceOption[]>({
    queryKey: ['quick-procedure-service-options', currentClinic?.id, language],
    queryFn: () => loadActiveClinicServiceOptions(currentClinic!.id, language),
    enabled: !!currentClinic?.id,
  });

  const addToPlanMutation = useMutation({
    mutationFn: async ({
      service,
      consentConfirmed,
    }: {
      service: ClinicServiceOption;
      consentConfirmed: boolean;
    }) => {
      if (!consentConfirmed) {
        throw new Error("CONSENT_REQUIRED");
      }
      const unitPrice = Number(service.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error("INVALID_UNIT_PRICE");
      }
      if (!currentClinic?.id) {
        throw new Error("CLINIC_REQUIRED");
      }

      return createTreatmentPlan({
        patientId,
        clinicId: currentClinic.id,
        title: service.name,
        description: null,
        discountType: "PERCENT",
        discountValue: 0,
        discountComment: null,
        patientConsentConfirmed: true,
        items: [{
          serviceId: service.id,
          toothNumber,
          description: service.name,
          quantity: 1,
          unitPrice,
          stageName: null,
          notes: null,
        }],
      });
    },
    onSuccess: () => {
      toast.success(`${t("patientCabinet.procedureAdded")} #${toothNumber}`);
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', patientId] });
      setIsOpen(false);
      setPatientConsentConfirmed(false);
      onProcedureAdded?.();
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error && error.message === "INVALID_UNIT_PRICE"
          ? `${t("crmTreatmentDialogs.price")} > 0`
          : error instanceof Error && error.message === "CONSENT_REQUIRED"
            ? t("crmTreatmentForm.consentRequired")
          : t("patientCabinet.procedureAddError"),
      );
    },
  });

  // Mutation to write into tooth history
  const addToHistoryMutation = useMutation({
    mutationFn: async ({ serviceName, status }: { serviceName: string; status: string }) => {
      const { error } = await supabase
        .from('tooth_history')
        .insert({
          patient_id: patientId,
          tooth_number: toothNumber,
          status_after: status,
          procedure_name: serviceName,
          doctor_id: doctorId,
          clinic_id: currentClinic?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tooth-history', patientId, toothNumber] });
    },
  });

  const handleAddProcedure = (service: ClinicServiceOption) => {
    addToPlanMutation.mutate({ service, consentConfirmed: patientConsentConfirmed });
  };

  // Group services by category
  const servicesByCategory: Record<string, ClinicServiceOption[]> = services?.reduce<Record<string, ClinicServiceOption[]>>((acc, service) => {
    const category = service.category || t("patientCabinet.categoryOther");
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {}) || {};

  const isLoading = addToPlanMutation.isPending;

  if (!currentClinic) {
    return null;
  }

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setPatientConsentConfirmed(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("patientCabinet.addToTreatmentPlan")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          {t("patientCabinet.addProcedureForTooth")} #{toothNumber}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-2 py-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id={consentId}
              checked={patientConsentConfirmed}
              onCheckedChange={(checked) => setPatientConsentConfirmed(checked === true)}
              aria-describedby={!patientConsentConfirmed ? `${consentId}-hint` : undefined}
            />
            <Label htmlFor={consentId} className="cursor-pointer text-xs leading-4">
              {t("crmTreatmentForm.planExplained")}
            </Label>
          </div>
          {!patientConsentConfirmed && (
            <p id={`${consentId}-hint`} className="mt-1.5 pl-6 text-xs text-destructive">
              {t("crmTreatmentForm.consentRequired")}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />

        {/* Services available to add */}
        {services && services.length > 0 ? (
          Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-1">
                {category}
              </DropdownMenuLabel>
              {categoryServices.map(service => (
                <DropdownMenuItem
                  key={service.id}
                  onClick={() => handleAddProcedure(service)}
                  disabled={!patientConsentConfirmed || isLoading}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{service.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {service.price?.toLocaleString()} {t("patientCabinet.sumLabel")}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          ))
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <p>{t("patientCabinet.noActivePlans")}</p>
            <p className="text-xs mt-1">{t("patientCabinet.createPlanFirst")}</p>
          </div>
        )}

        {/* Quick actions without a plan */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("patientCabinet.quickStatuses")}
        </DropdownMenuLabel>
        {[
          { status: 'filling', label: t("patientCabinet.fillingInstalled"), icon: '🔵' },
          { status: 'crown', label: t("patientCabinet.crownInstalled"), icon: '👑' },
          { status: 'endo', label: t("patientCabinet.endoStatus"), icon: '🔴' },
          { status: 'healthy', label: t("patientCabinet.cured"), icon: '✅' },
        ].map(item => (
          <DropdownMenuItem
            key={item.status}
            onClick={() => addToHistoryMutation.mutate({ 
              serviceName: item.label, 
              status: item.status 
            })}
            className="cursor-pointer"
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
