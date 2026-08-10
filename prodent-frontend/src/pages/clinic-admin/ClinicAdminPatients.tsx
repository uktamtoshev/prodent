import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { PatientOperations } from "@/components/staff-operations/StaffOperations";

export default function ClinicAdminPatients() {
  return (
    <ClinicAdminLayout>
      <PatientOperations />
    </ClinicAdminLayout>
  );
}
