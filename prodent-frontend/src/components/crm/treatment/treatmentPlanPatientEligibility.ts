import {
  getEligibleTreatmentPlanPatients,
  type EligibleTreatmentPlanPatientPageDto,
} from "@/lib/treatment-plans-api";

export async function loadEligiblePatients(
  clinicId: string,
  search: string,
  page: number,
  size = 50,
  signal?: AbortSignal,
): Promise<EligibleTreatmentPlanPatientPageDto> {
  return getEligibleTreatmentPlanPatients({ clinicId, search, page, size, signal });
}
