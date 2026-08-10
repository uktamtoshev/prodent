import { TreatmentPlansList } from "@/components/crm/treatment/TreatmentPlansList";
import { Card, CardContent } from "@/components/ui/card";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface TreatmentPlanViewProps {
  patientId: string;
  doctorId?: string;
}

/**
 * Compatibility wrapper for older CRM imports. It deliberately uses the one
 * secured, typed implementation instead of keeping a second schema and API.
 */
export function TreatmentPlanView({ patientId, doctorId }: TreatmentPlanViewProps) {
  const { currentClinic } = useClinic();
  const { t } = useLanguage();

  if (!currentClinic?.id) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("crmMedicalRecords.selectClinicForPlans")}
        </CardContent>
      </Card>
    );
  }

  return (
    <TreatmentPlansList
      patientId={patientId}
      doctorId={doctorId || ""}
      clinicId={currentClinic.id}
    />
  );
}
