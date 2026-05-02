import { CRMLayout } from "@/components/crm/CRMLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceDashboard } from "@/components/crm/finance/FinanceDashboard";
import { TransactionsList } from "@/components/crm/finance/TransactionsList";
import { CashRegister } from "@/components/crm/finance/CashRegister";
import { InvoicesList } from "@/components/crm/finance/InvoicesList";
import { DebtsList } from "@/components/crm/finance/DebtsList";
import { SalariesList } from "@/components/crm/finance/SalariesList";
import { RentalPaymentsList } from "@/components/crm/finance/RentalPaymentsList";
import { StaffDoctorReport } from "@/components/crm/finance/StaffDoctorReport";
import { DoctorSalarySettings } from "@/components/crm/finance/DoctorSalarySettings";
import { DetailedDoctorReport } from "@/components/crm/finance/DetailedDoctorReport";
import { ComprehensiveReports } from "@/components/crm/finance/ComprehensiveReports";
import { DoctorPersonalIncome } from "@/components/crm/finance/DoctorPersonalIncome";
import { Wallet, FileText, CreditCard, AlertTriangle, Users, BarChart3, Building2, PieChart, Settings, ClipboardList, TrendingUp, DollarSign } from "lucide-react";

type TabType = "overview" | "cash" | "invoices" | "payments" | "debts" | "salaries" | "rental" | "staff-report" | "settings" | "detailed" | "reports" | "my-income";

export default function Finance() {
  const { currentClinic } = useClinic();
  const { 
    isDoctor,
    canAccessClinicFinance,
    canAccessClinicReports,
    canAccessCashRegister,
    canAccessSalarySettings,
  } = useUserRole();
  
  const defaultTab: TabType = canAccessClinicFinance ? "overview" : "my-income";
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [currency, setCurrency] = useState("UZS");

  // Load financial records for transactions tab
  const { data: financialRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["finance-records", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_records")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .order("date", { ascending: false })
        .limit(100);

      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  if (recordsLoading) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-muted" />
            ))}
          </div>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <PermissionGate module="finance">
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground">Финансы</h1>
            <p className="text-muted-foreground">Управление финансами клиники</p>
          </div>

          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UZS">UZS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="bg-muted/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
            {/* My Income - visible for all doctors */}
            {isDoctor && (
              <TabsTrigger value="my-income" className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                <DollarSign className="w-4 h-4" />
                Мой доход
              </TabsTrigger>
            )}
            
            {/* Admin-only tabs */}
            {canAccessClinicFinance && (
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <BarChart3 className="w-4 h-4" />
                Обзор
              </TabsTrigger>
            )}
            {canAccessCashRegister && (
              <TabsTrigger value="cash" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Wallet className="w-4 h-4" />
                Касса
              </TabsTrigger>
            )}
            {canAccessClinicFinance && (
              <>
                <TabsTrigger value="invoices" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <FileText className="w-4 h-4" />
                  Счета
                </TabsTrigger>
                <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <CreditCard className="w-4 h-4" />
                  Платежи
                </TabsTrigger>
                <TabsTrigger value="debts" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <AlertTriangle className="w-4 h-4" />
                  Долги
                </TabsTrigger>
                <TabsTrigger value="salaries" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Users className="w-4 h-4" />
                  Зарплаты
                </TabsTrigger>
                <TabsTrigger value="rental" className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400">
                  <Building2 className="w-4 h-4" />
                  Аренда
                </TabsTrigger>
              </>
            )}
            {canAccessClinicReports && (
              <>
                <TabsTrigger value="staff-report" className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                  <PieChart className="w-4 h-4" />
                  Обзор штат
                </TabsTrigger>
                <TabsTrigger value="detailed" className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
                  <ClipboardList className="w-4 h-4" />
                  Детали
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400">
                  <TrendingUp className="w-4 h-4" />
                  Отчёты
                </TabsTrigger>
              </>
            )}
            {canAccessSalarySettings && (
              <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400">
                <Settings className="w-4 h-4" />
                Ставки
              </TabsTrigger>
            )}
          </TabsList>

          {/* My Income Tab - for doctors */}
          <TabsContent value="my-income" className="mt-6">
            <DoctorPersonalIncome currency={currency} />
          </TabsContent>

          {/* Overview Tab - Now uses the new FinanceDashboard */}
          <TabsContent value="overview" className="mt-6">
            <FinanceDashboard currency={currency} />
          </TabsContent>

          {/* Cash Register Tab */}
          <TabsContent value="cash" className="mt-6">
            <CashRegister currency={currency} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <InvoicesList />
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-6">
            <TransactionsList transactions={financialRecords || []} />
          </TabsContent>

          {/* Debts Tab */}
          <TabsContent value="debts" className="mt-6">
            <DebtsList />
          </TabsContent>

          {/* Salaries Tab */}
          <TabsContent value="salaries" className="mt-6">
            <SalariesList />
          </TabsContent>

          {/* Rental Payments Tab */}
          <TabsContent value="rental" className="mt-6">
            <RentalPaymentsList />
          </TabsContent>

          {/* Staff Doctor Report Tab */}
          <TabsContent value="staff-report" className="mt-6">
            <StaffDoctorReport />
          </TabsContent>

          {/* Detailed Report Tab */}
          <TabsContent value="detailed" className="mt-6">
            <DetailedDoctorReport />
          </TabsContent>

          {/* Comprehensive Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <ComprehensiveReports />
          </TabsContent>

          {/* Salary Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <DoctorSalarySettings />
          </TabsContent>
        </Tabs>
      </div>
      </PermissionGate>
    </CRMLayout>
  );
}
