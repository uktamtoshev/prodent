import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { PromotionOperations } from "@/components/staff-operations/StaffOperations";

export default function ClinicAdminPromotions() {
  return (
    <ClinicAdminLayout>
      <PromotionOperations />
    </ClinicAdminLayout>
  );
}
