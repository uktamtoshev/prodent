import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface VisitHistoryProps {
  patientId: string;
}

interface VisitDoctorProfile {
  full_name: string | null;
}

interface VisitDoctor {
  id: string;
  profiles?: VisitDoctorProfile | null;
}

export function VisitHistory({ patientId }: VisitHistoryProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();

  const { data: visits, isLoading } = useQuery({
    queryKey: ["visit-history", patientId, currentClinic?.id],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          service,
          status,
          total_price,
          notes,
          doctors (
            id,
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq("patient_id", patientId)
        .order("appointment_date", { ascending: false });

      if (currentClinic?.id) {
        query = query.eq("clinic_id", currentClinic.id);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      // Hues are kept non-adjacent so neighbouring rows never blur together:
      // pending 38 (warning) / confirmed 199 (info) / completed 160 (success) /
      // cancelled 0 (danger). Nothing sits on the brand ramp between info and
      // success, so `confirmed` and `completed` stay tellable apart.
      pending: { label: t('crmTopLevel.statusNew'), className: "bg-status-warning/10 text-status-warning border-status-warning/20" },
      confirmed: { label: t('crmTopLevel.statusConfirmed'), className: "bg-status-info/10 text-status-info border-status-info/20" },
      completed: { label: t('crmTopLevel.statusCompleted'), className: "bg-status-success/10 text-status-success border-status-success/20" },
      cancelled: { label: t('crmTopLevel.statusCancelled'), className: "bg-status-danger/10 text-status-danger border-status-danger/20" },
    };
    return variants[status] || variants.pending;
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <Calendar className="w-5 h-5" />
          {t('crmTopLevel.visitHistory')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-muted" />
            ))}
          </div>
        ) : visits && visits.length > 0 ? (
          <div className="space-y-3">
            {visits.map((visit) => {
              const status = getStatusBadge(visit.status || "pending");
              const doctor = visit.doctors as VisitDoctor | null;
              const profile = doctor?.profiles;
              
              return (
                <div
                  key={visit.id}
                  className="p-4 bg-muted/50 rounded-lg border border-border/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-foreground font-medium">
                        {format(new Date(visit.appointment_date), "dd MMMM yyyy, HH:mm", { locale: ru })}
                      </span>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    {visit.total_price && (
                      <div className="flex items-center gap-1 text-foreground font-semibold">
                        <DollarSign className="w-4 h-4 text-primary" />
                        {visit.total_price.toLocaleString()} UZS
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground mb-1">
                    <strong className="text-foreground/80">{t('crmTopLevel.service')}</strong> {visit.service}
                  </div>
                  {profile?.full_name && (
                    <div className="text-muted-foreground text-sm">
                      <strong className="text-foreground/80">{t('crmTopLevel.doctor')}</strong> {profile.full_name}
                    </div>
                  )}
                  {visit.notes && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                      {visit.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('crmTopLevel.historyEmpty')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
