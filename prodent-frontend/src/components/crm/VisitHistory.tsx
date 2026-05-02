import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useClinic } from "@/contexts/ClinicContext";

interface VisitHistoryProps {
  patientId: string;
}

export function VisitHistory({ patientId }: VisitHistoryProps) {
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
          price,
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
      pending: { label: "Новая", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
      confirmed: { label: "Подтверждена", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
      completed: { label: "Завершена", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
      cancelled: { label: "Отменена", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
    };
    return variants[status] || variants.pending;
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Calendar className="w-5 h-5" />
          История посещений
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
              const doctor = visit.doctors as any;
              const profile = doctor?.profiles as any;
              
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
                    {visit.price && (
                      <div className="flex items-center gap-1 text-foreground font-semibold">
                        <DollarSign className="w-4 h-4 text-primary" />
                        {visit.price.toLocaleString()} UZS
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground mb-1">
                    <strong className="text-foreground/80">Услуга:</strong> {visit.service}
                  </div>
                  {profile?.full_name && (
                    <div className="text-muted-foreground text-sm">
                      <strong className="text-foreground/80">Врач:</strong> {profile.full_name}
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
            <p>История посещений пуста</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
