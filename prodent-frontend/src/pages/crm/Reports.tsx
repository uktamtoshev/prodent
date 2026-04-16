import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  FileText,
  PieChart
} from "lucide-react";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/utils";

const reportTypes = [
  {
    title: "Финансовый отчёт",
    description: "Доходы, расходы, прибыль за период",
    icon: DollarSign,
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Отчёт по пациентам",
    description: "Новые пациенты, визиты, конверсия",
    icon: Users,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Отчёт по врачам",
    description: "Загрузка врачей, выручка, рейтинг",
    icon: TrendingUp,
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Отчёт по услугам",
    description: "Популярные услуги, средний чек",
    icon: PieChart,
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Отчёт по записям",
    description: "Статистика записей, отмены, неявки",
    icon: Calendar,
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Отчёт по складу",
    description: "Остатки, расход материалов",
    icon: FileText,
    color: "from-indigo-500 to-blue-500",
  },
];

export default function Reports() {
  const { currentClinic } = useClinic();

  return (
    <CRMLayout>
      <PermissionGate module="reports">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground">Отчёты</h1>
            <p className="text-muted-foreground mt-1">
              {currentClinic ? `${currentClinic.name} • Аналитика и отчёты` : 'Выберите клинику'}
            </p>
          </div>
          <Button variant="outline" className="gap-2" disabled={!currentClinic}>
            <Download className="w-4 h-4" />
            Экспорт
          </Button>
        </div>

        {/* Report Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <Card 
                key={report.title}
                className={cn(
                  "border-border/50 bg-card/80 backdrop-blur-sm cursor-pointer",
                  "hover:shadow-medium transition-all duration-300 hover:border-primary/20",
                  "group relative overflow-hidden"
                )}
              >
                <div className={cn(
                  "absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity",
                  `bg-gradient-to-br ${report.color}`
                )} />
                <CardContent className="pt-6 relative">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      `bg-gradient-to-br ${report.color}`,
                      "text-white shadow-soft"
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">
                        {report.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-4 w-full justify-center text-primary hover:bg-primary/10"
                    disabled={!currentClinic}
                  >
                    Сформировать
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Placeholder */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Быстрая статистика
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>
                {currentClinic 
                  ? 'Выберите тип отчёта для просмотра статистики' 
                  : 'Выберите клинику для просмотра отчётов'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      </PermissionGate>
    </CRMLayout>
  );
}
