import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface TreatmentPlanProps {
  patientId: string;
}

export function TreatmentPlan({ patientId }: TreatmentPlanProps) {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["treatment-plan", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select(`
          id,
          service_name,
          tooth_number,
          status,
          price,
          notes,
          planned_date,
          completed_date,
          created_at
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      planned: { label: "Запланировано", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      in_progress: { label: "В процессе", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
      completed: { label: "Завершено", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      cancelled: { label: "Отменено", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    };
    return variants[status] || variants.planned;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">План лечения</CardTitle>
        <Button size="sm" className="bg-[#00C6BB] hover:bg-[#00B0A6]">
          <Plus className="w-4 h-4 mr-2" />
          Добавить процедуру
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full bg-slate-700" />
            ))}
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map((plan) => {
              const status = getStatusBadge(plan.status || "planned");
              
              return (
                <div
                  key={plan.id}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{plan.service_name}</span>
                        {plan.tooth_number && (
                          <span className="text-sm text-slate-400">
                            (Зуб #{plan.tooth_number})
                          </span>
                        )}
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      {plan.planned_date && (
                        <div className="flex items-center gap-1 text-sm text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Запланировано на {format(new Date(plan.planned_date), "dd.MM.yyyy", { locale: ru })}
                          </span>
                        </div>
                      )}
                    </div>
                    {plan.price && (
                      <div className="flex items-center gap-1 text-white font-semibold">
                        <DollarSign className="w-4 h-4 text-[#00C6BB]" />
                        {plan.price.toLocaleString()} UZS
                      </div>
                    )}
                  </div>
                  {plan.notes && (
                    <div className="mt-2 p-2 bg-slate-800/50 rounded text-sm text-slate-400">
                      {plan.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>План лечения пуст</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 border-slate-700 text-slate-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить первую процедуру
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
