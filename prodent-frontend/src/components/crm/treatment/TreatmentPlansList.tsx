import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Plus, Eye, Printer, QrCode, 
  CheckCircle, Clock, Copy, ExternalLink, Send 
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { TreatmentPlanForm } from "./TreatmentPlanForm";
import { TreatmentPlanPrintDialog } from "./TreatmentPlanPrintDialog";
import { ShareTreatmentPlanDialog } from "./ShareTreatmentPlanDialog";

interface TreatmentPlansListProps {
  patientId: string;
  doctorId: string;
  clinicId: string;
}

export function TreatmentPlansList({ patientId, doctorId, clinicId }: TreatmentPlansListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printPlanId, setPrintPlanId] = useState<string | null>(null);
  const [sharePlan, setSharePlan] = useState<{ name: string; token: string } | null>(null);

  // Fetch patient phone for share dialog
  const { data: patientProfile } = useQuery({
    queryKey: ["patient-phone", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", patientId)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId,
  });

  const { data: plans, isLoading, refetch } = useQuery({
    queryKey: ["treatment-plans", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select(`
          *,
          doctor:doctor_id(
            id,
            profiles:user_id(full_name)
          ),
          items:treatment_plan_items(count)
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price || 0) + " UZS";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Утверждён
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Черновик
          </Badge>
        );
      case "active":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Активный
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Завершён
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            Отменён
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handlePrint = (planId: string) => {
    setPrintPlanId(planId);
    setPrintDialogOpen(true);
  };

  const handleOpenPublicLink = (token: string) => {
    window.open(`/treatment-plan/${token}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Планы лечения ({plans?.length || 0})
        </h3>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать план
        </Button>
      </div>

      {plans?.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Нет планов лечения</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
            >
              Создать первый план
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans?.map((plan: any) => (
            <Card key={plan.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {plan.plan_number}
                      </span>
                      {getStatusBadge(plan.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Врач:</span>
                        <p className="font-medium truncate">
                          {plan.doctor?.profiles?.full_name || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Услуг:</span>
                        <p className="font-medium">{plan.items?.[0]?.count || 0}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Сумма:</span>
                        <p className="font-medium">{formatPrice(plan.final_price)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Дата:</span>
                        <p className="font-medium">
                          {format(new Date(plan.created_at), "dd.MM.yyyy", { locale: ru })}
                        </p>
                      </div>
                    </div>

                    {plan.discount_value > 0 && (
                      <div className="mt-2 text-sm">
                        <Badge variant="outline" className="text-green-500 border-green-500/30">
                          Скидка: {plan.discount_type === "percent" 
                            ? `${plan.discount_value}%` 
                            : formatPrice(plan.discount_value)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPlanId(plan.id)}
                      title="Открыть"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    {plan.status === "approved" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(plan.id)}
                          title="Печать"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        {plan.public_access_token && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPublicLink(plan.public_access_token)}
                              title="Публичная ссылка"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSharePlan({ name: plan.plan_number || plan.name || "План лечения", token: plan.public_access_token })}
                              title="Отправить пациенту"
                              className="text-primary"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <TreatmentPlanForm
        open={createDialogOpen || !!selectedPlanId}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setSelectedPlanId(null);
          }
        }}
        patientId={patientId}
        doctorId={doctorId}
        clinicId={clinicId}
        planId={selectedPlanId || undefined}
        onSuccess={() => refetch()}
      />

      {/* Print Dialog */}
      {printPlanId && (
        <TreatmentPlanPrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          planId={printPlanId}
        />
      )}

      {/* Share Dialog */}
      {sharePlan && (
        <ShareTreatmentPlanDialog
          open={!!sharePlan}
          onOpenChange={(open) => !open && setSharePlan(null)}
          planName={sharePlan.name}
          publicToken={sharePlan.token}
          patientPhone={patientProfile?.phone}
        />
      )}
    </div>
  );
}
