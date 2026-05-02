import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { FileText, Plus, Search, CreditCard } from "lucide-react";
import { CreateInvoiceDialog } from "./CreateInvoiceDialog";
import { toast } from "sonner";

export function InvoicesList() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCurrency, setPaymentCurrency] = useState("UZS");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select(`
          *,
          patient:profiles!invoices_patient_id_fkey(full_name, phone),
          doctor:doctors!invoices_doctor_id_fkey(id, profiles:user_id(full_name))
        `)
        .eq("clinic_id", currentClinic?.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Calculate paid amounts
  const { data: paymentsMap } = useQuery({
    queryKey: ["invoice-payments", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .not("invoice_id", "is", null);

      const map: Record<string, number> = {};
      data?.forEach((p) => {
        if (p.invoice_id) {
          map[p.invoice_id] = (map[p.invoice_id] || 0) + p.amount;
        }
      });
      return map;
    },
    enabled: !!currentClinic?.id,
  });

  const getStatusBadge = (status: string, paidAmount: number, totalAmount: number) => {
    if (status === "paid" || paidAmount >= totalAmount) {
      return { label: "Оплачен", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" };
    }
    if (paidAmount > 0) {
      return { label: "Частично", className: "bg-amber-500/20 text-amber-400 border-amber-500/50" };
    }
    if (status === "cancelled") {
      return { label: "Отменён", className: "bg-red-500/20 text-red-400 border-red-500/50" };
    }
    return { label: "Новый", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" };
  };

  const filteredInvoices = invoices?.filter((inv) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(search) ||
      (inv.patient as any)?.full_name?.toLowerCase().includes(search)
    );
  });

  // Mutation for adding payment
  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice || !paymentAmount) throw new Error("Missing data");
      
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

      const { error } = await supabase.from("payments").insert({
        clinic_id: currentClinic?.id,
        user_id: selectedInvoice.patient_id,
        doctor_id: selectedInvoice.doctor_id,
        invoice_id: selectedInvoice.id,
        amount: Math.round(amount),
        currency: paymentCurrency,
        payment_method: paymentMethod,
        status: "completed",
        description: `Оплата счёта ${selectedInvoice.invoice_number}`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments"] });
      toast.success("Оплата добавлена");
      setSelectedInvoice(null);
      setPaymentAmount("");
    },
    onError: (error: any) => {
      toast.error("Ошибка: " + error.message);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру или пациенту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать счёт
        </Button>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Счета ({filteredInvoices?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices && filteredInvoices.length > 0 ? (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => {
                const paidAmount = paymentsMap?.[invoice.id] || 0;
                const statusBadge = getStatusBadge(invoice.status, paidAmount, invoice.final_amount);
                const remainingAmount = invoice.final_amount - paidAmount;

                return (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-foreground font-medium">
                          {invoice.invoice_number}
                        </span>
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(invoice.patient as any)?.full_name} • {format(new Date(invoice.created_at), "dd.MM.yyyy", { locale: ru })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        {invoice.final_amount.toLocaleString()} {invoice.currency}
                      </div>
                      {paidAmount > 0 && paidAmount < invoice.final_amount && (
                        <div className="text-sm text-muted-foreground">
                          Оплачено: {paidAmount.toLocaleString()} • Остаток: {remainingAmount.toLocaleString()}
                        </div>
                      )}
                    </div>
                    {remainingAmount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-4"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Оплатить
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Счета не найдены</p>
            </div>
          )}
        </CardContent>
      </Card>

      {currentClinic?.id && (
        <CreateInvoiceDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog} 
          clinicId={currentClinic.id}
        />
      )}
      
      {/* Payment Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оплата счёта {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Сумма счёта</p>
              <p className="text-lg font-bold text-foreground">
                {selectedInvoice?.final_amount?.toLocaleString()} {selectedInvoice?.currency}
              </p>
              {paymentsMap?.[selectedInvoice?.id] > 0 && (
                <p className="text-sm text-muted-foreground">
                  Оплачено: {paymentsMap[selectedInvoice.id].toLocaleString()} • 
                  Остаток: {(selectedInvoice.final_amount - paymentsMap[selectedInvoice.id]).toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Сумма оплаты</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`Макс: ${selectedInvoice?.final_amount - (paymentsMap?.[selectedInvoice?.id] || 0)}`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Способ оплаты</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Наличные</SelectItem>
                    <SelectItem value="card">Карта</SelectItem>
                    <SelectItem value="online">Онлайн</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Валюта</Label>
                <Select value={paymentCurrency} onValueChange={setPaymentCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                Отмена
              </Button>
              <Button 
                onClick={() => addPaymentMutation.mutate()}
                disabled={addPaymentMutation.isPending || !paymentAmount}
              >
                {addPaymentMutation.isPending ? "Сохранение..." : "Оплатить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
