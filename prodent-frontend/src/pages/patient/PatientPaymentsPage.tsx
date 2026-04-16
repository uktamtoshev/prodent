import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddPaymentNoteDialog } from "@/components/patient/AddPaymentNoteDialog";
import { 
  CreditCard, 
  FileText, 
  Download, 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  TrendingUp, 
  Receipt,
  Zap,
  ArrowRight,
  Clock,
  Shield,
  Plus,
  Trash2,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

interface PaymentNote {
  id: string;
  amount: number;
  type: "payment" | "debt";
  description: string | null;
  clinic_name: string | null;
  date: string;
  is_resolved: boolean;
  created_at: string;
}

const PatientPaymentsPage = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentNotes, setPaymentNotes] = useState<PaymentNote[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [myDebts, setMyDebts] = useState(0);
  const [myPayments, setMyPayments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (user?.id) fetchPaymentData();
  }, [user?.id]);

  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false }) as any;

      if (invoicesData) {
        setInvoices(invoicesData);
        const debt = invoicesData.filter((inv: any) => inv.status !== 'paid').reduce((sum: number, inv: any) => sum + inv.final_amount, 0);
        setTotalDebt(debt);
      }

      const paymentsResult = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const paymentsData = paymentsResult.data;

      if (paymentsData) {
        setPayments(paymentsData);
        const paid = paymentsData.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        setTotalPaid(paid);
      }

      // Fetch personal notes
      const { data: notesData } = await supabase
        .from('patient_payment_notes')
        .select('*')
        .eq('patient_id', user?.id)
        .order('date', { ascending: false });

      if (notesData) {
        setPaymentNotes(notesData as PaymentNote[]);
        const debts = notesData
          .filter((n: any) => n.type === 'debt' && !n.is_resolved)
          .reduce((sum: number, n: any) => sum + n.amount, 0);
        const pays = notesData
          .filter((n: any) => n.type === 'payment')
          .reduce((sum: number, n: any) => sum + n.amount, 0);
        setMyDebts(debts);
        setMyPayments(pays);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  

  const handleResolveDebt = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('patient_payment_notes')
        .update({ is_resolved: true })
        .eq('id', noteId);

      if (error) throw error;
      toast.success("Долг погашен");
      fetchPaymentData();
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('patient_payment_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      toast.success("Запись удалена");
      fetchPaymentData();
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-jade mx-auto animate-pulse-soft" />
              <Loader2 className="w-8 h-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground">Загрузка данных...</p>
          </div>
        </div>
      </PatientLayout>
    );
  }

  const unresolvedDebts = paymentNotes.filter(n => n.type === 'debt' && !n.is_resolved);
  const resolvedDebts = paymentNotes.filter(n => n.type === 'debt' && n.is_resolved);
  const myPaymentNotes = paymentNotes.filter(n => n.type === 'payment');

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="relative">
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-jade">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground">
                  Счета и оплаты
                </h1>
              </div>
              <p className="text-muted-foreground ml-12">Управляйте вашими финансами</p>
            </div>
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-jade text-white shadow-medium hover:shadow-strong"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить запись
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My Debts */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-medium">
            <CardContent className="p-5 relative">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">Мои долги</p>
                <p className="text-2xl font-bold text-foreground">{formatPrice(myDebts)}</p>
                {unresolvedDebts.length > 0 && (
                  <Badge className="mt-2 w-fit bg-amber-500/20 text-amber-600 border-0">
                    {unresolvedDebts.length} записей
                  </Badge>
                )}
              </div>
              <Receipt className="absolute top-4 right-4 w-8 h-8 text-amber-500/30" />
            </CardContent>
          </Card>

          {/* My Payments */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-medium">
            <CardContent className="p-5 relative">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">Мои оплаты</p>
                <p className="text-2xl font-bold text-foreground">{formatPrice(myPayments)}</p>
                {myPaymentNotes.length > 0 && (
                  <Badge className="mt-2 w-fit bg-emerald-500/20 text-emerald-600 border-0">
                    {myPaymentNotes.length} записей
                  </Badge>
                )}
              </div>
              <CheckCircle2 className="absolute top-4 right-4 w-8 h-8 text-emerald-500/30" />
            </CardContent>
          </Card>

          {/* Clinic Debt */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-medium">
            <CardContent className="p-5 relative">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">Долг клиникам</p>
                <p className="text-2xl font-bold text-foreground">{formatPrice(totalDebt)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  По счетам
                </p>
              </div>
              <FileText className="absolute top-4 right-4 w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>

          {/* Total Paid */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-tashkent-sky/10 via-tashkent-sky/5 to-transparent shadow-medium">
            <CardContent className="p-5 relative">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">Оплачено</p>
                <p className="text-2xl font-bold text-foreground">{formatPrice(totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Через систему
                </p>
              </div>
              <CreditCard className="absolute top-4 right-4 w-8 h-8 text-tashkent-sky/30" />
            </CardContent>
          </Card>
        </div>

        {/* Online Payment Section */}
        {(totalDebt > 0 || myDebts > 0) && (
          <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 shadow-strong">
            <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
            <CardContent className="p-6 relative">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold font-heading">Быстрая оплата онлайн</h3>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Оплатите счёт удобным способом. Мгновенное зачисление, безопасные транзакции.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span>Защищённое соединение</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    className="bg-[#00CDBE] hover:bg-[#00CDBE]/90 text-white font-bold px-6 h-12 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <span className="mr-2">💳</span> Payme
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    className="bg-[#0099FF] hover:bg-[#0099FF]/90 text-white font-bold px-6 h-12 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <span className="mr-2">💎</span> Click
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="my-notes" className="space-y-6">
          <TabsList className="bg-muted/30 p-1.5 h-auto flex-wrap">
            <TabsTrigger value="my-notes" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2.5 rounded-lg">
              <Receipt className="w-4 h-4 mr-2" />
              Мои записи
              {paymentNotes.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-500/10 text-amber-600">
                  {paymentNotes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2.5 rounded-lg">
              <FileText className="w-4 h-4 mr-2" />
              Счета
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                  {invoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2.5 rounded-lg">
              <CreditCard className="w-4 h-4 mr-2" />
              Оплаты системы
            </TabsTrigger>
          </TabsList>

          {/* My Notes Tab */}
          <TabsContent value="my-notes" className="space-y-6 animate-fade-in">
            {/* Unresolved Debts */}
            {unresolvedDebts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Активные долги
                </h3>
                {unresolvedDebts.map((note) => (
                  <Card key={note.id} className="border-amber-500/20 bg-amber-500/5 hover:shadow-medium transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/20">
                            <Receipt className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{formatPrice(note.amount)}</p>
                            {note.clinic_name && (
                              <p className="text-sm text-foreground/80">{note.clinic_name}</p>
                            )}
                            {note.description && (
                              <p className="text-sm text-muted-foreground">{note.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(note.date), "d MMMM yyyy", { locale: ru })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleResolveDebt(note.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Погасить
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* My Payments */}
            {myPaymentNotes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Мои оплаты
                </h3>
                {myPaymentNotes.map((note) => (
                  <Card key={note.id} className="border-emerald-500/20 bg-emerald-500/5 hover:shadow-medium transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/20">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">{formatPrice(note.amount)}</p>
                            {note.clinic_name && (
                              <p className="text-sm text-foreground/80">{note.clinic_name}</p>
                            )}
                            {note.description && (
                              <p className="text-sm text-muted-foreground">{note.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(note.date), "d MMMM yyyy", { locale: ru })}
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Resolved Debts */}
            {resolvedDebts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Погашенные долги
                </h3>
                {resolvedDebts.map((note) => (
                  <Card key={note.id} className="border-muted bg-muted/30 opacity-70 hover:opacity-100 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-muted-foreground line-through">{formatPrice(note.amount)}</p>
                            {note.clinic_name && (
                              <p className="text-sm text-muted-foreground">{note.clinic_name}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(note.date), "d MMMM yyyy", { locale: ru })}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-muted text-muted-foreground">Погашено</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {paymentNotes.length === 0 && (
              <Card className="border-dashed border-2 border-muted-foreground/20">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
                    <Receipt className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Нет записей</p>
                  <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                    Добавьте долги или оплаты чтобы не забыть
                  </p>
                  <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-jade text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить запись
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4 animate-fade-in">
            {invoices.length > 0 ? invoices.map((inv, index) => (
              <Card 
                key={inv.id} 
                className="border-border/30 hover:border-primary/30 hover:shadow-medium transition-all duration-200 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${inv.status === 'paid' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                        {inv.status === 'paid' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            className={`${
                              inv.status === 'paid' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            } border`}
                          >
                            {inv.status === 'paid' ? '✓ Оплачен' : '⏳ Ожидает'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            #{inv.invoice_number || inv.id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{formatPrice(inv.final_amount)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(inv.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:self-center">
                      {inv.status !== 'paid' && (
                        <Button size="sm" className="bg-gradient-jade text-white">
                          Оплатить
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="group-hover:border-primary/50">
                        <Download className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-dashed border-2 border-muted-foreground/20">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Нет счетов</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Счета появятся после визита</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 animate-fade-in">
            {payments.length > 0 ? payments.map((p, index) => (
              <Card 
                key={p.id} 
                className="border-border/30 hover:border-primary/30 hover:shadow-medium transition-all duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-emerald-500/10">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">{formatPrice(p.amount)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {p.payment_method || 'Наличные'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(p.created_at), "d MMMM yyyy", { locale: ru })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Успешно
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-dashed border-2 border-muted-foreground/20">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
                    <CreditCard className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Нет оплат</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">История оплат появится здесь</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AddPaymentNoteDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchPaymentData}
      />
    </PatientLayout>
  );
};

export default PatientPaymentsPage;
