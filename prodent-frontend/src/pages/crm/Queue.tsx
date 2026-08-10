import { CRMLayout } from "@/components/crm/CRMLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { EnhancedLiveQueue } from "@/components/crm/dashboard/EnhancedLiveQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Users } from "lucide-react";

export default function Queue() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();

  // Resolve the current doctor (if the logged-in staff member is a doctor) so
  // the live-queue widget can scope to their chair. clinic_id alone is enough
  // for admins/managers — doctorId is optional.
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor", currentClinic?.id],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id, clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <CRMLayout>
      <div className="space-y-6 p-4 pb-24 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
              <Activity className="h-3.5 w-3.5" />
              <span>{t("crmDashboardWidgets.liveQueueTitle")}</span>
            </div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
              {t("crmQueue.title")}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("crmQueue.description")}
            </p>
          </div>
        </div>

        {/* Reuse the working live-queue widget (reads appointments_queue, which
            is exposed via the data proxy). It renders its own loading/empty
            states, so no fake/placeholder data is shown. */}
        <EnhancedLiveQueue
          doctorId={currentDoctor?.id}
          clinicId={currentClinic?.id}
        />
      </div>
    </CRMLayout>
  );
}
