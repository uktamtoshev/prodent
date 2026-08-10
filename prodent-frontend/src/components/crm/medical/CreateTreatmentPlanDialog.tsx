import { TreatmentPlanForm } from "@/components/crm/treatment/TreatmentPlanForm";

interface CreateTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId: string;
  clinicId: string;
}

/**
 * Compatibility wrapper for older CRM imports. Creation is delegated to the
 * same current REST-backed form used by the active treatment-plan screen.
 */
export function CreateTreatmentPlanDialog(props: CreateTreatmentPlanDialogProps) {
  return <TreatmentPlanForm {...props} />;
}
