import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, FileText, Building2, User, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function TreatmentPlanPublic() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-treatment-plan", token],
    queryFn: async () => {
      const { data: plan, error: planError } = await supabase
        .from("treatment_plans")
        .select(`
          *,
          patient:patient_id(full_name),
          doctor:doctor_id(profiles:user_id(full_name)),
          clinic:clinic_id(name, address)
        `)
        .eq("public_access_token", token)
        .eq("status", "approved")
        .single();

      if (planError) throw planError;

      const { data: items } = await supabase
        .from("treatment_plan_items")
        .select("*")
        .eq("plan_id", plan.id)
        .order("created_at");

      return { plan, items: items || [] };
    },
    enabled: !!token,
  });

  const formatPrice = (price: number) => 
    new Intl.NumberFormat("uz-UZ").format(price || 0) + " UZS";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data?.plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">План не найден</h2>
            <p className="text-muted-foreground">
              Ссылка недействительна или план ещё не утверждён
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="w-5 h-5 text-primary" />
                  {data.plan.clinic?.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.plan.clinic?.address}
                </p>
              </div>
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Утверждён
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">№ плана</span>
              <p className="font-mono font-medium">{data.plan.plan_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Пациент</span>
              <p className="font-medium">{data.plan.patient?.full_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Врач</span>
              <p className="font-medium">{data.plan.doctor?.profiles?.full_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Дата</span>
              <p className="font-medium">
                {format(new Date(data.plan.approved_at || data.plan.created_at), "dd.MM.yyyy", { locale: ru })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Услуги</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">№</th>
                    <th className="text-left py-2 font-medium">Зуб</th>
                    <th className="text-left py-2 font-medium">Услуга</th>
                    <th className="text-center py-2 font-medium">Кол.</th>
                    <th className="text-right py-2 font-medium">Цена</th>
                    <th className="text-right py-2 font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item: any, idx: number) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-3">{idx + 1}</td>
                      <td className="py-3">{item.tooth_number || "—"}</td>
                      <td className="py-3">{item.procedure}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">{formatPrice(item.price)}</td>
                      <td className="py-3 text-right font-medium">
                        {formatPrice(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 space-y-2">
            <div className="flex justify-between">
              <span>Сумма услуг:</span>
              <span>{formatPrice(data.plan.total_price)}</span>
            </div>
            {data.plan.discount_value > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Скидка:</span>
                <span>−{formatPrice(
                  data.plan.discount_type === "percent"
                    ? Math.round(data.plan.total_price * data.plan.discount_value / 100)
                    : data.plan.discount_value
                )}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>К оплате:</span>
              <span className="text-primary">{formatPrice(data.plan.final_price)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
