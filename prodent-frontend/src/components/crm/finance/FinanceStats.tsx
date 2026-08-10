import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FinanceStatsProps {
  totalRevenue: number;
  averageCheck: number;
  patientsCount: number;
  conversionRate: number;
}

export function FinanceStats({ totalRevenue, averageCheck, patientsCount, conversionRate }: FinanceStatsProps) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('crmFinanceDashStats.totalRevenue')}</CardTitle>
          <DollarSign className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRevenue.toLocaleString()} UZS</div>
          <p className="text-xs text-muted-foreground mt-1">{t('crmFinanceDashStats.forSelectedPeriod')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('crmFinanceDashStats.avgCheck')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageCheck.toLocaleString()} UZS</div>
          <p className="text-xs text-muted-foreground mt-1">{t('crmFinanceDashStats.perPatient')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('crmFinanceDashStats.totalPatients')}</CardTitle>
          <Users className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{patientsCount}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('crmFinanceDashStats.forSelectedPeriod')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('crmFinanceDashStats.apptConversion')}</CardTitle>
          <Percent className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">{t('crmFinanceDashStats.completedOfTotal')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
