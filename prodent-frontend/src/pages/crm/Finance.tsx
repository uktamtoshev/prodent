import { CRMLayout } from "@/components/crm/CRMLayout";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CashRegister } from "@/components/crm/finance/CashRegister";
import { ClinicFinanceOperations } from "@/components/crm/finance/ClinicFinanceOperations";
import { SalariesList } from "@/components/crm/finance/SalariesList";
import { RentalPaymentsList } from "@/components/crm/finance/RentalPaymentsList";
import { StaffDoctorReport } from "@/components/crm/finance/StaffDoctorReport";
import { DoctorSalarySettings } from "@/components/crm/finance/DoctorSalarySettings";
import { DetailedDoctorReport } from "@/components/crm/finance/DetailedDoctorReport";
import { Wallet, FileText, CreditCard, AlertTriangle, Users, BarChart3, Building2, PieChart, Settings, ClipboardList, TrendingUp, DollarSign } from "lucide-react";
import { getReportSummary } from "@/lib/crm-operations-api";
import { formatPrice } from "@/lib/utils";

type TabType = "overview" | "cash" | "invoices" | "payments" | "debts" | "salaries" | "rental" | "staff-report" | "settings" | "detailed" | "reports" | "my-income";

const DoctorPersonalIncome = lazy(() =>
  import("@/components/crm/finance/DoctorPersonalIncome").then((module) => ({
    default: module.DoctorPersonalIncome,
  })),
);

function FinanceTabFallback() {
  const { t } = useLanguage();

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </CardContent>
    </Card>
  );
}

function AuthoritativeFinanceSummary({ currency }: { currency: string }) {
  const { currentClinic } = useClinic();
  const { language } = useLanguage();
  const uz = language === "uz";
  const today = new Date();
  const to = today.toLocaleDateString("en-CA");
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-CA");
  const summary = useQuery({
    queryKey: ["s7-finance-summary", currentClinic?.id, from, to],
    queryFn: () => getReportSummary(currentClinic!.id, from, to),
    enabled: !!currentClinic?.id,
  });
  const cards = [
    [uz ? "To‘lovlar" : "Платежи", Number(summary.data?.payments || 0)],
    [uz ? "Qaytarishlar" : "Возвраты", Number(summary.data?.refunds || 0)],
    [uz ? "Qarz" : "Долг", Number(summary.data?.outstandingDebt || 0)],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{uz ? "Server jurnalidan joriy oy" : "Текущий месяц по серверному журналу операций"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, amount]) => (
          <Card key={String(label)}><CardContent className="p-card-x">
            <p className="text-meta font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-kpi tabular-nums font-heading">{summary.isLoading ? "—" : formatPrice(Number(amount), currency, false)}</p>
          </CardContent></Card>
        ))}
      </div>
      {summary.isError && <p className="text-sm text-destructive">{uz ? "Hisobot yuklanmadi" : "Отчёт не загрузился"}</p>}
    </div>
  );
}

export default function Finance() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isDoctor,
    canAccessClinicFinance,
    canAccessClinicReports,
    canAccessCashRegister,
    canAccessSalarySettings,
  } = useUserRole();

  const availableTabs = useMemo<TabType[]>(() => {
    const tabs: TabType[] = [];

    if (isDoctor) tabs.push("my-income");
    if (canAccessClinicFinance) {
      tabs.push("overview", "invoices", "payments", "debts", "salaries", "rental");
    }
    if (canAccessCashRegister) tabs.push("cash");
    if (canAccessClinicReports) tabs.push("staff-report", "detailed", "reports");
    if (canAccessSalarySettings) tabs.push("settings");

    return tabs;
  }, [
    canAccessCashRegister,
    canAccessClinicFinance,
    canAccessClinicReports,
    canAccessSalarySettings,
    isDoctor,
  ]);

  const requestedTab = searchParams.get("tab") as TabType | null;
  const defaultTab: TabType =
    requestedTab && availableTabs.includes(requestedTab)
      ? requestedTab
      : availableTabs[0] ?? (canAccessClinicFinance ? "overview" : "my-income");
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [currency, setCurrency] = useState("UZS");

  useEffect(() => {
    const nextTab =
      requestedTab && availableTabs.includes(requestedTab)
        ? requestedTab
        : availableTabs[0] ?? defaultTab;

    setActiveTab((currentTab) => {
      if (!requestedTab && availableTabs.includes(currentTab)) {
        return currentTab;
      }

      return currentTab === nextTab ? currentTab : nextTab;
    });
  }, [availableTabs, defaultTab, requestedTab]);

  const handleTabChange = (value: string) => {
    const nextTab = value as TabType;

    setActiveTab(nextTab);
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("tab", nextTab);
      return nextParams;
    });
  };

  return (
    <CRMLayout>
      <PermissionGate module="finance">
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmFinance.title")}</h1>
            <p className="text-muted-foreground">{t("crmFinance.description")}</p>
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
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
            {/* My Income - visible for all doctors */}
            {isDoctor && (
              <TabsTrigger value="my-income" className="gap-2">
                <DollarSign className="w-4 h-4" />
                {t("crmFinance.tabMyIncome")}
              </TabsTrigger>
            )}
            
            {/* Admin-only tabs */}
            {canAccessClinicFinance && (
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                {t("crmFinance.tabOverview")}
              </TabsTrigger>
            )}
            {canAccessCashRegister && (
              <TabsTrigger value="cash" className="gap-2">
                <Wallet className="w-4 h-4" />
                {t("crmFinance.tabCash")}
              </TabsTrigger>
            )}
            {canAccessClinicFinance && (
              <>
                <TabsTrigger value="invoices" className="gap-2">
                  <FileText className="w-4 h-4" />
                  {t("crmFinance.tabInvoices")}
                </TabsTrigger>
                <TabsTrigger value="payments" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  {t("crmFinance.tabPayments")}
                </TabsTrigger>
                <TabsTrigger value="debts" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t("crmFinance.tabDebts")}
                </TabsTrigger>
                <TabsTrigger value="salaries" className="gap-2">
                  <Users className="w-4 h-4" />
                  {t("crmFinance.tabSalaries")}
                </TabsTrigger>
                <TabsTrigger value="rental" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  {t("crmFinance.tabRental")}
                </TabsTrigger>
              </>
            )}
            {canAccessClinicReports && (
              <>
                <TabsTrigger value="staff-report" className="gap-2">
                  <PieChart className="w-4 h-4" />
                  {t("crmFinance.tabStaffReport")}
                </TabsTrigger>
                <TabsTrigger value="detailed" className="gap-2">
                  <ClipboardList className="w-4 h-4" />
                  {t("crmFinance.tabDetailed")}
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {t("crmFinance.tabReports")}
                </TabsTrigger>
              </>
            )}
            {canAccessSalarySettings && (
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                {t("crmFinance.tabSettings")}
              </TabsTrigger>
            )}
          </TabsList>

          {/* My Income Tab - for doctors */}
          <TabsContent value="my-income" className="mt-6">
            <Suspense fallback={<FinanceTabFallback />}>
              <DoctorPersonalIncome currency={currency} />
            </Suspense>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <AuthoritativeFinanceSummary currency={currency} />
          </TabsContent>

          {/* Cash Register Tab */}
          <TabsContent value="cash" className="mt-6">
            <CashRegister currency={currency} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <ClinicFinanceOperations focus="invoices" />
          </TabsContent>

          {/* Payments Tab — payments/financial_records are not exposed via the
              data proxy in the pilot; show an honest state instead of a
              silently-empty list. */}
          <TabsContent value="payments" className="mt-6">
            <ClinicFinanceOperations focus="payments" />
          </TabsContent>

          {/* Debts Tab */}
          <TabsContent value="debts" className="mt-6">
            <ClinicFinanceOperations focus="debts" />
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

          <TabsContent value="reports" className="mt-6">
            <AuthoritativeFinanceSummary currency={currency} />
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
