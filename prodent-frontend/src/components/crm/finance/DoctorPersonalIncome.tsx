import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  Armchair,
  Building2,
  UserCheck,
  Percent
} from "lucide-react";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/lib/utils";

interface DoctorPersonalIncomeProps {
  currency?: string;
}

export function DoctorPersonalIncome({ currency = "UZS" }: DoctorPersonalIncomeProps) {
  const { currentClinic } = useClinic();
  const { doctorId, isStaffDoctor, isChairRental, cooperationType } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { start: periodStart, end: periodEnd } = useMemo(() => {
    const monthDate = new Date(selectedMonth + "-01");
    return {
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate)
    };
  }, [selectedMonth]);

  // Fetch doctor info
  const { data: doctorInfo } = useQuery({
    queryKey: ["doctor-personal-info", doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          cooperation_type,
          profiles:user_id(full_name)
        `)
        .eq("id", doctorId!)
        .single();
      return data;
    },
    enabled: !!doctorId,
  });

  // Fetch doctor's appointments for the period
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["doctor-personal-appointments", doctorId, selectedMonth, currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          price,
          service,
          status,
          appointment_date,
          profiles:patient_id(full_name)
        `)
        .eq("doctor_id", doctorId!)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString())
        .order("appointment_date", { ascending: false });
      return data || [];
    },
    enabled: !!doctorId && !!currentClinic?.id,
  });

  // Fetch salary records for this doctor
  const { data: salaryRecords } = useQuery({
    queryKey: ["doctor-salary-records", doctorId, selectedMonth, currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctor_salaries")
        .select("*")
        .eq("doctor_id", doctorId!)
        .eq("clinic_id", currentClinic?.id)
        .gte("period_start", periodStart.toISOString())
        .lte("period_end", periodEnd.toISOString())
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!doctorId && !!currentClinic?.id && isStaffDoctor,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!appointments) return null;
    
    const totalRevenue = appointments.reduce((sum, a) => sum + (a.price || 0), 0);
    const salaryPercent = doctorInfo?.salary_percent || 30;
    
    // For staff doctors - calculate their share
    // For chair rental - they keep 100% (minus rental fee)
    const doctorShare = isStaffDoctor 
      ? Math.round(totalRevenue * (salaryPercent / 100))
      : totalRevenue;
    
    const clinicShare = isStaffDoctor ? totalRevenue - doctorShare : 0;
    const patientsCount = new Set(appointments.map(a => a.patient_id)).size;
    const appointmentsCount = appointments.length;
    
    // Daily chart data
    const dailyData: { [key: string]: number } = {};
    appointments.forEach(a => {
      const date = format(parseISO(a.appointment_date), "dd.MM");
      dailyData[date] = (dailyData[date] || 0) + (a.price || 0);
    });
    
    const chartData = Object.entries(dailyData)
      .map(([date, value]) => ({ date, revenue: value }))
      .reverse();

    return {
      totalRevenue,
      doctorShare,
      clinicShare,
      salaryPercent,
      patientsCount,
      appointmentsCount,
      chartData,
    };
  }, [appointments, doctorInfo, isStaffDoctor]);

  const formatCurrency = (amount: number) => {
    return formatPrice(amount, currency, false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isChairRental ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
            {isChairRental ? (
              <Armchair className="w-6 h-6 text-amber-500" />
            ) : (
              <Building2 className="w-6 h-6 text-emerald-500" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold">Мой доход</h2>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={isChairRental ? 'border-amber-500/30 text-amber-600' : 'border-emerald-500/30 text-emerald-600'}
              >
                {isChairRental ? 'Арендатор кресла' : 'Штатный врач'}
              </Badge>
              {isStaffDoctor && doctorInfo?.salary_percent && (
                <Badge variant="secondary" className="gap-1">
                  <Percent className="w-3 h-3" />
                  {doctorInfo.salary_percent}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Общая выручка
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              За выбранный период
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${isStaffDoctor ? '' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isStaffDoctor ? 'Моя доля' : 'Мой доход'}
            </CardTitle>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(stats?.doctorShare || 0)}
            </div>
            {isStaffDoctor && (
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.salaryPercent}% от выручки
              </p>
            )}
            {isChairRental && (
              <p className="text-xs text-muted-foreground mt-1">
                100% (вне кассы клиники)
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Пациентов
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.patientsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Уникальных пациентов
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Приёмов
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.appointmentsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Завершённых приёмов
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {stats?.chartData && stats.chartData.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Динамика выручки
            </CardTitle>
            <CardDescription>
              Ежедневная выручка за {format(periodStart, "LLLL yyyy", { locale: ru })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Выручка"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Appointments list */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Завершённые приёмы
          </CardTitle>
          <CardDescription>
            Детализация по приёмам за период
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Пациент</TableHead>
                <TableHead>Услуга</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                {isStaffDoctor && (
                  <TableHead className="text-right">Моя доля</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments && appointments.length > 0 ? (
                appointments.map(apt => (
                  <TableRow key={apt.id}>
                    <TableCell>
                      {format(parseISO(apt.appointment_date), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {(apt.profiles as any)?.full_name || "—"}
                    </TableCell>
                    <TableCell>{apt.service}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(apt.price || 0)}
                    </TableCell>
                    {isStaffDoctor && (
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(Math.round((apt.price || 0) * ((doctorInfo?.salary_percent || 30) / 100)))}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isStaffDoctor ? 5 : 4} className="text-center text-muted-foreground py-8">
                    Нет приёмов за выбранный период
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Salary records for staff doctors */}
      {isStaffDoctor && salaryRecords && salaryRecords.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Начисления зарплаты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Период</TableHead>
                  <TableHead>Выручка</TableHead>
                  <TableHead>Процент</TableHead>
                  <TableHead>Начислено</TableHead>
                  <TableHead>Бонус</TableHead>
                  <TableHead>Итого</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(parseISO(record.period_start), "dd.MM")} - {format(parseISO(record.period_end), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>{formatCurrency(record.total_revenue)}</TableCell>
                    <TableCell>{record.salary_percent}%</TableCell>
                    <TableCell>{formatCurrency(record.calculated_salary)}</TableCell>
                    <TableCell className="text-emerald-600">
                      +{formatCurrency(record.bonus || 0)}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(record.final_salary)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.status === 'paid' ? 'default' : 'secondary'}>
                        {record.status === 'paid' ? 'Выплачено' : 'Ожидает'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
