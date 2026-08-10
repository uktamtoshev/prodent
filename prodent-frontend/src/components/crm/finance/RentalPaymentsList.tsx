import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { Building2, Plus, Check, DollarSign, AlertTriangle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type ProfileSummary = { full_name: string | null };
type DoctorProfile = ProfileSummary | ProfileSummary[] | null;
type RentalDoctor = {
  id: string;
  profiles: DoctorProfile;
};
type RentalPaymentDoctor = {
  id: string;
  profiles: DoctorProfile;
};
type RentalPaymentWithDoctor = {
  doctor: RentalPaymentDoctor | RentalPaymentDoctor[] | null;
};

const getProfileName = (profile: DoctorProfile | undefined) =>
  Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

const getDoctorName = (
  doctor: RentalPaymentDoctor | RentalPaymentDoctor[] | null | undefined,
) => getProfileName(Array.isArray(doctor) ? doctor[0]?.profiles : doctor?.profiles);

export function RentalPaymentsList() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const periodStart = startOfMonth(new Date(selectedMonth + "-01"));
  const periodEnd = endOfMonth(new Date(selectedMonth + "-01"));

  // Get chair rental doctors
  const { data: rentalDoctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ["rental-doctors", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          cooperation_type,
          profiles:user_id(full_name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "chair_rental");
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get rental payments for the period
  const { data: rentalPayments, isLoading: loadingPayments } = useQuery({
    queryKey: ["rental-payments", currentClinic?.id, selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("rental_payments")
        .select(`
          *,
          doctor:doctors(id, profiles:user_id(full_name))
        `)
        .eq("clinic_id", currentClinic?.id)
        .gte("period_start", format(periodStart, "yyyy-MM-dd"))
        .lte("period_end", format(periodEnd, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rental_payments").insert({
        clinic_id: currentClinic?.id,
        doctor_id: selectedDoctor,
        amount: parseInt(amount),
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        notes,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-payments"] });
      toast.success(t('crmFinanceComponents.rentalPaymentCreated'));
      setAddDialogOpen(false);
      setSelectedDoctor("");
      setAmount("");
      setNotes("");
    },
    onError: () => {
      toast.error(t('crmFinanceComponents.paymentCreateError'));
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("rental_payments")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString(),
          payment_method: "cash"
        })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-payments"] });
      toast.success(t('crmFinanceComponents.paymentMarkedPaid'));
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  const isLoading = loadingDoctors || loadingPayments;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: LucideIcon }> = {
      pending: { label: t('crmFinanceComponents.statusPending'), className: "bg-status-warning/20 text-status-warning border-status-warning/50", icon: AlertTriangle },
      paid: { label: t('crmFinanceComponents.statusPaid'), className: "bg-status-success/20 text-status-success border-status-success/50", icon: Check },
      overdue: { label: t('crmFinanceComponents.statusOverdue'), className: "bg-status-danger/20 text-status-danger border-status-danger/50", icon: AlertTriangle },
    };
    return variants[status] || variants.pending;
  };

  // Calculate totals
  const totalExpected = rentalPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPaid = rentalPayments?.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPending = totalExpected - totalPaid;

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  if (!currentClinic) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-16 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t("crmReports.selectClinicForReports")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setAddDialogOpen(true)} disabled={!rentalDoctors?.length}>
          <Plus className="w-4 h-4 mr-2" />
          {t('crmFinanceComponents.addPaymentBtn')}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-warning/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-status-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmFinanceComponents.expectedRental')}</p>
                <p className="text-xl font-bold text-foreground">{totalExpected.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-success/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmFinanceComponents.statusPaid')}</p>
                <p className="text-xl font-bold text-status-success">{totalPaid.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-danger/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-status-danger" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmFinanceComponents.toPay')}</p>
                <p className="text-xl font-bold text-status-danger">{totalPending.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments list */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Building2 className="w-5 h-5" />
            {t('crmFinanceComponents.rentalPaymentsFor')} {format(periodStart, "LLLL yyyy", { locale: ru })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rentalPayments && rentalPayments.length > 0 ? (
            <div className="space-y-3">
              {rentalPayments.map((payment) => {
                const statusBadge = getStatusBadge(payment.status);
                const StatusIcon = statusBadge.icon;
                
                return (
                  <div key={payment.id} className="p-4 bg-muted/30 rounded-2xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-status-warning/20 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-status-warning" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {getDoctorName((payment as typeof payment & RentalPaymentWithDoctor).doctor) || t('crmFinanceComponents.doctor')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('crmFinanceComponents.chairRental')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusBadge.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusBadge.label}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xl font-bold text-foreground">
                        {payment.amount.toLocaleString()} {payment.currency}
                      </p>
                      
                      {payment.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => markPaidMutation.mutate(payment.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          {t('crmFinanceComponents.markPaid')}
                        </Button>
                      )}
                    </div>

                    {payment.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('crmFinanceComponents.noRentalPayments')}</p>
              {rentalDoctors && rentalDoctors.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('crmFinanceComponents.addPaymentBtn')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add payment dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crmFinanceComponents.addRentalPayment')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('crmFinanceComponents.tenantDoctor')}</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder={t('crmFinanceComponents.selectDoctor')} />
                </SelectTrigger>
                <SelectContent>
                  {(rentalDoctors as RentalDoctor[] | undefined)?.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {getProfileName(doctor.profiles) || t('crmFinanceComponents.doctor')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-payments-list-field-1">{t('crmFinanceComponents.amountUZS')}</Label>
              <Input id="rental-payments-list-field-1"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental-payments-list-field-2">{t('crmFinanceComponents.note')}</Label>
              <Textarea id="rental-payments-list-field-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('crmFinanceComponents.rentalForMonth')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t('crmFinanceComponents.cancel')}
            </Button>
            <Button
              onClick={() => createPaymentMutation.mutate()}
              disabled={!selectedDoctor || !amount || createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('crmFinanceComponents.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
