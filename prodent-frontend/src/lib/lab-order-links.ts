interface DoctorLabOrderSource {
  patientId: string;
  medicalRecordId?: string | null;
  treatmentPlanId?: string | null;
  treatmentPlanItemId?: string | null;
}

export function buildDoctorLabOrderPath(source: DoctorLabOrderSource): string {
  const search = new URLSearchParams();
  search.set("patient_id", source.patientId);
  if (source.medicalRecordId) {
    search.set("medical_record_id", source.medicalRecordId);
  }
  if (source.treatmentPlanId) {
    search.set("treatment_plan_id", source.treatmentPlanId);
  }
  if (source.treatmentPlanItemId) {
    search.set("treatment_plan_item_id", source.treatmentPlanItemId);
  }
  return `/doctor/laboratory?${search.toString()}`;
}
