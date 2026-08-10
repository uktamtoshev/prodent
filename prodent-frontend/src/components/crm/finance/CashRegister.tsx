import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Wallet, TrendingUp, TrendingDown, Lock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface CashRegisterProps {
  currency: string;
}

export function CashRegister({ currency }: CashRegisterProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: cashRegister, isLoading } = useQuery({
    queryKey: ["cash-register", currentClinic?.id, today, currency],
    queryFn: async () => {
      const { data } = await supabase
        .from("cash_register")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .eq("date", today)
        .eq("currency", currency)
        .maybeSingle();
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  // Get today's payments
  const { data: todayPayments } = useQuery({
    queryKey: ["today-payments", currentClinic?.id, today, currency],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .eq("currency", currency)
        .eq("status", "completed")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  const openCashMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cash_register").insert({
        clinic_id: currentClinic?.id,
        date: today,
        currency,
        opening_balance: 0,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      toast.success(t('crmFinanceComponents.cashOpened'));
    },
    onError: () => {
      toast.error(t('crmFinanceComponents.cashOpenError'));
    },
  });

  const closeCashMutation = useMutation({
    mutationFn: async () => {
      const totalIncome = todayPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("cash_register")
        .update({
          status: "closed",
          closing_balance: (cashRegister?.opening_balance || 0) + totalIncome,
          total_income: totalIncome,
          closed_by: user.user?.id,
        })
        .eq("id", cashRegister?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      toast.success(t('crmFinanceComponents.cashClosed'));
    },
    onError: () => {
      toast.error(t('crmFinanceComponents.cashCloseError'));
    },
  });

  const totalIncome = todayPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const currentBalance = (cashRegister?.opening_balance || 0) + totalIncome;

  if (isLoading) {
    return <Skeleton className="h-48 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Wallet className="w-5 h-5" />
              {t('crmFinanceComponents.cashRegisterFor')} {format(new Date(), "dd MMMM yyyy", { locale: ru })}
            </CardTitle>
            <Badge variant="outline" className={cashRegister?.status === "open"
              ? "bg-status-success/20 text-status-success border-status-success/50"
              : "bg-muted text-muted-foreground"}>
              {cashRegister?.status === "open" ? t('crmFinanceComponents.statusOpened') : cashRegister ? t('crmFinanceComponents.statusClosed') : t('crmFinanceComponents.statusNotOpened')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="w-4 h-4" />
                {t('crmFinanceComponents.openingBalance')}
              </div>
              <div className="text-xl font-bold text-foreground">
                {(cashRegister?.opening_balance || 0).toLocaleString()} {currency}
              </div>
            </div>
            <div className="p-4 bg-status-success/10 rounded-lg">
              <div className="flex items-center gap-2 text-status-success text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                {t('crmFinanceComponents.dailyIncome')}
              </div>
              <div className="text-xl font-bold text-status-success">
                +{totalIncome.toLocaleString()} {currency}
              </div>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2 text-primary text-sm mb-1">
                <Wallet className="w-4 h-4" />
                {t('crmFinanceComponents.currentBalance')}
              </div>
              <div className="text-xl font-bold text-primary">
                {currentBalance.toLocaleString()} {currency}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!cashRegister ? (
              <Button onClick={() => openCashMutation.mutate()} disabled={openCashMutation.isPending}>
                <Wallet className="w-4 h-4 mr-2" />
                {t('crmFinanceComponents.openCash')}
              </Button>
            ) : cashRegister.status === "open" ? (
              <Button
                variant="outline"
                onClick={() => closeCashMutation.mutate()}
                disabled={closeCashMutation.isPending}
              >
                <Lock className="w-4 h-4 mr-2" />
                {t('crmFinanceComponents.closeCash')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Recent payments */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">{t('crmFinanceComponents.todayPayments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayPayments && todayPayments.length > 0 ? (
            <div className="space-y-2">
              {todayPayments.slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-foreground font-medium">{payment.description || t('crmFinanceComponents.paymentDefault')}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.created_at), "HH:mm", { locale: ru })} • {payment.payment_method}
                    </p>
                  </div>
                  <span className="text-status-success font-semibold">
                    +{payment.amount.toLocaleString()} {currency}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">{t('crmFinanceComponents.noTodayPayments')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
