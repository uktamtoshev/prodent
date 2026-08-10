import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Plus, Eye, Printer,
  CheckCircle, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { TreatmentPlanForm } from "./TreatmentPlanForm";
import { TreatmentPlanPrintDialog } from "./TreatmentPlanPrintDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TreatmentPlanStatus,
  getClinicPatientTreatmentPlans,
  getPatientTreatmentPlans,
} from "@/lib/treatment-plans-api";

interface TreatmentPlansListProps {
  patientId: string;
  doctorId: string;
  clinicId: string;
}

export function TreatmentPlansList({ patientId, doctorId, clinicId }: TreatmentPlansListProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printPlanId, setPrintPlanId] = useState<string | null>(null);

  const { data: plans, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "treatment-plans",
      "patient",
      patientId,
      doctorId ? "doctor" : `clinic:${clinicId}`,
    ],
    queryFn: async ({ signal }) => {
      const result = doctorId
        ? await getPatientTreatmentPlans(patientId, signal)
        : await getClinicPatientTreatmentPlans(patientId, clinicId);
      return result.sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
    },
    enabled: !!patientId && (!!doctorId || !!clinicId),
  });

  const formatPrice = (price: number, currency = "UZS") => {
    try {
      return new Intl.NumberFormat("uz-UZ", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "UZS" ? 0 : 2,
      }).format(price || 0);
    } catch {
      return `${new Intl.NumberFormat("uz-UZ").format(price || 0)} ${currency}`;
    }
  };

  const getStatusBadge = (status: TreatmentPlanStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-status-success/20 text-status-success border-status-success/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t("crmTreatmentDialogs.statusCompleted")}
          </Badge>
        );
      case "PLANNED":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {t("crmTreatmentDialogs.statusDraft")}
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Clock className="w-3 h-3 mr-1" />
            {t("crmTreatmentDialogs.statusActive")}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-status-danger/20 text-status-danger border-status-danger/30">
            {t("crmTreatmentDialogs.statusCancelled")}
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">{t("common.error")}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            {t("treatmentPlanPublic.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t("crmTreatmentDialogs.treatmentPlans")} ({plans?.length || 0})
        </h3>
        {doctorId && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("crmTreatmentDialogs.createPlan")}
          </Button>
        )}
      </div>

      {plans?.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t("crmTreatmentDialogs.noTreatmentPlans")}</p>
            {doctorId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setCreateDialogOpen(true)}
              >
                {t("crmTreatmentDialogs.createFirstPlan")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans?.map((plan) => (
            <Card key={plan.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="p-card-x">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground truncate">
                        {plan.title}
                      </span>
                      {getStatusBadge(plan.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("crmTreatmentDialogs.doctorShort")}</span>
                        <p className="font-medium truncate">
                          {plan.doctorName || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("crmTreatmentDialogs.servicesShort")}</span>
                        <p className="font-medium">{plan.items.length}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("crmTreatmentDialogs.sumLabel")}</span>
                        <p className="font-medium">{formatPrice(plan.totalCost, plan.currency)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("crmTreatmentDialogs.dateLabel")}</span>
                        <p className="font-medium">
                          {format(new Date(plan.createdAt), "dd.MM.yyyy", { locale: ru })}
                        </p>
                      </div>
                    </div>

                    {plan.discountAmount > 0 && (
                      <div className="mt-2 text-sm">
                        <Badge variant="outline" className="text-status-success border-status-success/30">
                          {t("crmTreatmentDialogs.discount")}: {plan.discountType === "PERCENT"
                            ? `${plan.discountValue}%`
                            : formatPrice(plan.discountValue, plan.currency)}
                        </Badge>
                      </div>
                    )}

                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/crm/treatment-plans/${plan.id}`)}
                      title={t("crmTreatmentDialogs.open")}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    {plan.status !== "CANCELLED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(plan.id)}
                          title={t("crmTreatmentDialogs.print")}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {doctorId && (
        <TreatmentPlanForm
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          patientId={patientId}
          doctorId={doctorId}
          clinicId={clinicId}
          onSuccess={() => refetch()}
        />
      )}

      {/* Print Dialog */}
      {printPlanId && (
        <TreatmentPlanPrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          planId={printPlanId}
        />
      )}

    </div>
  );
}
