import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, DollarSign, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { CreateTreatmentPlanDialog } from "./CreateTreatmentPlanDialog";
import { toast } from "sonner";

interface TreatmentPlanViewProps {
  patientId: string;
  doctorId?: string;
}

export function TreatmentPlanView({ patientId, doctorId }: TreatmentPlanViewProps) {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Загружаем планы лечения
  const { data: plans, isLoading } = useQuery({
    queryKey: ["treatment-plans", patientId, currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select(`
          *,
          doctor:doctors!treatment_plans_doctor_id_fkey(
            id,
            user:profiles!doctors_user_id_fkey(full_name)
          )
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentClinic?.id && !!patientId,
  });

  // Загружаем элементы плана
  const { data: planItems } = useQuery({
    queryKey: ["treatment-plan-items", selectedPlan],
    queryFn: async () => {
      if (!selectedPlan) return [];
      const { data } = await supabase
        .from("treatment_plan_items")
        .select("*")
        .eq("plan_id", selectedPlan)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedPlan,
  });

  // Мутация удаления плана
  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("treatment_plans")
        .delete()
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-plans", patientId] });
      toast.success("План лечения удалён");
      setSelectedPlan(null);
    },
    onError: () => {
      toast.error("Ошибка удаления плана");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: "Активный", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      completed: { label: "Завершён", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      cancelled: { label: "Отменён", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    };
    return variants[status] || variants.active;
  };

  const getItemStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      planned: { label: "Запланировано", className: "bg-yellow-500/10 text-yellow-500" },
      completed: { label: "Выполнено", className: "bg-green-500/10 text-green-500" },
    };
    return variants[status] || variants.planned;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Планы лечения</h2>
          {doctorId && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать план
            </Button>
          )}
        </div>

        {plans && plans.length > 0 ? (
          <div className="space-y-4">
            {plans.map((plan) => {
              const status = getStatusBadge(plan.status || "active");
              const isExpanded = selectedPlan === plan.id;
              const items = isExpanded ? planItems || [] : [];

              return (
                <Card key={plan.id} className="bg-card/80 border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-foreground">{(plan as any).name}</CardTitle>
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </div>
                        {(plan as any).description && (
                          <p className="text-sm text-muted-foreground mb-2">{(plan as any).description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Врач: {(plan.doctor as any)?.user?.full_name || "Не указан"}
                          </span>
                          <span>
                            {format(new Date(plan.created_at), "dd.MM.yyyy", { locale: ru })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-primary font-semibold">
                            <DollarSign className="w-4 h-4" />
                            {(plan as any).total_price?.toLocaleString() || 0} UZS
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePlan.mutate(plan.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && items.length > 0 && (
                    <CardContent className="border-t border-border pt-4">
                      <div className="space-y-2">
                        {items.map((item) => {
                          const itemStatus = getItemStatusBadge(item.status || "planned");
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground font-medium">{item.procedure}</span>
                                  {item.tooth_number && (
                                    <span className="text-sm text-muted-foreground">
                                      (Зуб #{item.tooth_number})
                                    </span>
                                  )}
                                  <Badge variant="outline" className={itemStatus.className}>
                                    {itemStatus.label}
                                  </Badge>
                                </div>
                                {item.notes && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                                )}
                              </div>
                              <div className="text-foreground font-medium">
                                {item.price?.toLocaleString() || 0} UZS
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}

                  <div className="px-6 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPlan(isExpanded ? null : plan.id)}
                      className="text-primary hover:text-primary/90"
                    >
                      {isExpanded ? "Скрыть детали" : "Показать детали"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card/80 border-border/50">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Планы лечения отсутствуют</p>
                {doctorId && (
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать первый план
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {doctorId && currentClinic && (
        <CreateTreatmentPlanDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          patientId={patientId}
          doctorId={doctorId}
          clinicId={currentClinic.id}
        />
      )}
    </>
  );
}
