import { TreatmentPlanView } from "@/components/crm/medical/TreatmentPlanView";

interface TreatmentPlanProps {
  patientId: string;
}

/**
 * Compatibility entry point retained for older CRM imports. The active view
 * owns clinic scoping, authorization-aware reads and the canonical schema.
 */
export function TreatmentPlan({ patientId }: TreatmentPlanProps) {
  return <TreatmentPlanView patientId={patientId} />;
}
