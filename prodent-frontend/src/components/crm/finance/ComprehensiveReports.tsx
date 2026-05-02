import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  TrendingUp, 
  Users, 
  Building2,
  ArrowRight,
  DollarSign,
  Armchair,
  BarChart3,
  Scale,
  UserCheck,
  Calendar,
  Filter
} from "lucide-react";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

type ReportTab = "clinic" | "rental" | "individual" | "comparison";
type PeriodType = "week" | "month" | "quarter" | "year" | "custom";

export function ComprehensiveReports() {
  const { currentClinic } = useClinic();
  const [activeReport, setActiveReport] = useState<ReportTab>("clinic");
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [cooperationType, setCooperationType] = useState<string>("all");

  const getDateRange = () => {
    const now = new Date();
    switch (periodType) {
      case "week":
        return { start: startOfWeek(now, { locale: ru }), end: endOfWeek(now, { locale: ru }) };
      case "month":
        return { start: startOfMonth(new Date(selectedMonth + "-01")), end: endOfMonth(new Date(selectedMonth + "-01")) };
      case "quarter":
        return { start: subMonths(startOfMonth(now), 2), end: endOfMonth(now) };
      case "year":
        return { start: subMonths(startOfMonth(now), 11), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(new Date(selectedMonth + "-01")), end: endOfMonth(new Date(selectedMonth + "-01")) };
    }
  };

  const { start: periodStart, end: periodEnd } = getDateRange();

  // Get all doctors
  const { data: doctors } = useQuery({
    queryKey: ["all-doctors-for-reports", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          cooperation_type,
          profiles:user_id(full_name)
        `)
        .eq("clinic_id", currentClinic?.id);
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get clinic patients (not personal)
  const { data: clinicPatientIds } = useQuery({
    queryKey: ["clinic-patient-ids-reports", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic?.id)
        .eq("role", "patient")
        .is("assigned_doctor_id", null);
      return data?.map(p => p.user_id) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get all appointments for the period
  const { data: allAppointments, isLoading } = useQuery({
    queryKey: ["comprehensive-report-appointments", currentClinic?.id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(`
          id,
          doctor_id,
          patient_id,
          price,
          service,
          status,
          appointment_date
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString());
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get rental payments
  const { data: rentalPayments } = useQuery({
    queryKey: ["rental-payments-reports", currentClinic?.id, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .like("description", "%аренд%")
        .gte("created_at", periodStart.toISOString())
        .lte("created_at", periodEnd.toISOString());
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  // Calculate reports
  const reports = useMemo(() => {
    if (!doctors || !allAppointments || !clinicPatientIds) return null;

    const staffDoctors = doctors.filter(d => d.cooperation_type === "staff_doctor");
    const rentalDoctors = doctors.filter(d => d.cooperation_type === "chair_rental");

    // Clinic income (only staff doctors with clinic patients)
    const staffDoctorIds = staffDoctors.map(d => d.id);
    const clinicAppointments = allAppointments.filter(
      a => staffDoctorIds.includes(a.doctor_id) && clinicPatientIds.includes(a.patient_id)
    );
    
    const clinicRevenue = clinicAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
    const clinicDoctorShare = clinicAppointments.reduce((sum, a) => {
      const doctor = doctors.find(d => d.id === a.doctor_id);
      const percent = doctor?.salary_percent || 30;
      return sum + Math.round((a.price || 0) * (percent / 100));
    }, 0);
    const clinicProfit = clinicRevenue - clinicDoctorShare;

    // Rental income (from rental payments + potential chair rental)
    const rentalIncome = rentalPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    // Per-doctor stats
    const doctorStats = doctors
      .filter(d => {
        if (cooperationType === "all") return true;
        return d.cooperation_type === cooperationType;
      })
      .filter(d => {
        if (selectedDoctor === "all") return true;
        return d.id === selectedDoctor;
      })
      .map(doctor => {
        const doctorAppointments = allAppointments.filter(a => a.doctor_id === doctor.id);
        const isStaff = doctor.cooperation_type === "staff_doctor";
        
        // For staff doctors, only count clinic patients
        const relevantAppointments = isStaff 
          ? doctorAppointments.filter(a => clinicPatientIds.includes(a.patient_id))
          : doctorAppointments;
        
        const revenue = relevantAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
        const salaryPercent = doctor.salary_percent || (isStaff ? 30 : 0);
        const doctorShare = isStaff ? Math.round(revenue * (salaryPercent / 100)) : revenue;
        const clinicShare = isStaff ? revenue - doctorShare : 0;
        
        // Group by date for chart
        const dailyData: { [key: string]: number } = {};
        relevantAppointments.forEach(a => {
          const date = format(new Date(a.appointment_date), "dd.MM");
          dailyData[date] = (dailyData[date] || 0) + (a.price || 0);
        });

        return {
          id: doctor.id,
          name: (doctor.profiles as any)?.full_name || "Врач",
          type: doctor.cooperation_type,
          typeName: isStaff ? "Штатный" : "Арендатор",
          salaryPercent,
          revenue,
          doctorShare,
          clinicShare,
          appointmentsCount: relevantAppointments.length,
          patientsCount: new Set(relevantAppointments.map(a => a.patient_id)).size,
          dailyData: Object.entries(dailyData).map(([date, value]) => ({ date, value })),
        };
      });

    // Comparison data
    const staffTotal = doctorStats
      .filter(d => d.type === "staff_doctor")
      .reduce((acc, d) => ({
        revenue: acc.revenue + d.revenue,
        clinicShare: acc.clinicShare + d.clinicShare,
        doctorShare: acc.doctorShare + d.doctorShare,
        appointments: acc.appointments + d.appointmentsCount,
        patients: acc.patients + d.patientsCount,
      }), { revenue: 0, clinicShare: 0, doctorShare: 0, appointments: 0, patients: 0 });

    const rentalTotal = {
      revenue: rentalIncome,
      clinicShare: rentalIncome,
      appointments: doctorStats.filter(d => d.type === "chair_rental").reduce((sum, d) => sum + d.appointmentsCount, 0),
      patients: doctorStats.filter(d => d.type === "chair_rental").reduce((sum, d) => sum + d.patientsCount, 0),
    };

    return {
      clinic: {
        revenue: clinicRevenue,
        doctorShare: clinicDoctorShare,
        profit: clinicProfit,
        appointments: clinicAppointments.length,
        patients: new Set(clinicAppointments.map(a => a.patient_id)).size,
      },
      rental: {
        income: rentalIncome,
        doctorsCount: rentalDoctors.length,
      },
      doctors: doctorStats,
      comparison: {
        staff: staffTotal,
        rental: rentalTotal,
      },
    };
  }, [doctors, allAppointments, clinicPatientIds, rentalPayments, cooperationType, selectedDoctor]);

  const COLORS = ["hsl(var(--primary))", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6"];

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-card/80 border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Фильтры:</span>
            </div>
            
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Неделя</SelectItem>
                <SelectItem value="month">Месяц</SelectItem>
                <SelectItem value="quarter">Квартал</SelectItem>
                <SelectItem value="year">Год</SelectItem>
              </SelectContent>
            </Select>

            {periodType === "month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] bg-background border-border">
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
            )}

            <Select value={cooperationType} onValueChange={setCooperationType}>
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue placeholder="Тип сотрудничества" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="staff_doctor">Штатные врачи</SelectItem>
                <SelectItem value="chair_rental">Арендаторы</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[200px] bg-background border-border">
                <SelectValue placeholder="Выберите врача" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все врачи</SelectItem>
                {doctors?.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {(doctor.profiles as any)?.full_name || "Врач"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeReport} onValueChange={(v) => setActiveReport(v as ReportTab)}>
        <TabsList className="bg-muted/50 border border-border/50 h-auto p-1 flex-wrap gap-1">
          <TabsTrigger value="clinic" className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500">
            <Building2 className="w-4 h-4" />
            Доход клиники
          </TabsTrigger>
          <TabsTrigger value="rental" className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500">
            <Armchair className="w-4 h-4" />
            Доход по аренде
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500">
            <UserCheck className="w-4 h-4" />
            Доход врача
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-500">
            <Scale className="w-4 h-4" />
            Сравнение моделей
          </TabsTrigger>
        </TabsList>

        {/* Clinic Income Tab */}
        <TabsContent value="clinic" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Выручка (штат)</p>
                    <p className="text-2xl font-bold text-foreground">{(reports?.clinic.revenue || 0).toLocaleString()} UZS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Выплаты врачам</p>
                    <p className="text-2xl font-bold text-amber-400">{(reports?.clinic.doctorShare || 0).toLocaleString()} UZS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Чистая прибыль</p>
                    <p className="text-2xl font-bold text-emerald-400">{(reports?.clinic.profit || 0).toLocaleString()} UZS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Flow */}
          {reports?.clinic && reports.clinic.revenue > 0 && (
            <Card className="bg-card/80 border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Распределение дохода</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center flex-1">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{reports.clinic.revenue.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Выручка</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center flex-1">
                    <Users className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-2xl font-bold text-amber-400">{reports.clinic.doctorShare.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Врачам ({Math.round(reports.clinic.doctorShare / reports.clinic.revenue * 100)}%)</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center flex-1">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-2xl font-bold text-emerald-400">{reports.clinic.profit.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Клинике ({Math.round(reports.clinic.profit / reports.clinic.revenue * 100)}%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staff Doctors Breakdown */}
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Детализация по штатным врачам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports?.doctors.filter(d => d.type === "staff_doctor").map((doctor) => (
                  <div key={doctor.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-medium text-foreground">{doctor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Ставка: {doctor.salaryPercent}% • {doctor.appointmentsCount} приёмов • {doctor.patientsCount} пациентов
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                        Штатный
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Выручка</p>
                        <p className="text-lg font-bold text-foreground">{doctor.revenue.toLocaleString()} UZS</p>
                      </div>
                      <div className="p-3 bg-amber-500/10 rounded-lg">
                        <p className="text-xs text-amber-400 mb-1">Доля врача</p>
                        <p className="text-lg font-bold text-amber-400">{doctor.doctorShare.toLocaleString()} UZS</p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-lg">
                        <p className="text-xs text-emerald-400 mb-1">Доля клиники</p>
                        <p className="text-lg font-bold text-emerald-400">{doctor.clinicShare.toLocaleString()} UZS</p>
                      </div>
                    </div>
                  </div>
                ))}
                {reports?.doctors.filter(d => d.type === "staff_doctor").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет штатных врачей</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rental Income Tab */}
        <TabsContent value="rental" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Доход от аренды</p>
                    <p className="text-2xl font-bold text-amber-400">{(reports?.rental.income || 0).toLocaleString()} UZS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Armchair className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Арендаторов</p>
                    <p className="text-2xl font-bold text-foreground">{reports?.rental.doctorsCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Среднее на арендатора</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {reports?.rental.doctorsCount ? Math.round((reports?.rental.income || 0) / reports.rental.doctorsCount).toLocaleString() : 0} UZS
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rental Doctors Breakdown */}
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Armchair className="w-5 h-5 text-amber-500" />
                Арендаторы кресел
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports?.doctors.filter(d => d.type === "chair_rental").map((doctor) => (
                  <div key={doctor.id} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-medium text-foreground">{doctor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doctor.appointmentsCount} приёмов • {doctor.patientsCount} личных пациентов
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                        Арендатор
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Личных приёмов</p>
                        <p className="text-lg font-bold text-foreground">{doctor.appointmentsCount}</p>
                      </div>
                      <div className="p-3 bg-amber-500/10 rounded-lg">
                        <p className="text-xs text-amber-400 mb-1">Вне кассы клиники</p>
                        <p className="text-lg font-bold text-amber-400">{doctor.revenue.toLocaleString()} UZS</p>
                      </div>
                    </div>
                  </div>
                ))}
                {reports?.doctors.filter(d => d.type === "chair_rental").length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Armchair className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет арендаторов</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Doctor Tab */}
        <TabsContent value="individual" className="space-y-6 mt-6">
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-500" />
                Индивидуальные отчёты врачей
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {reports?.doctors.map((doctor) => (
                  <div key={doctor.id} className={`p-6 rounded-lg border ${doctor.type === "staff_doctor" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{doctor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doctor.typeName} • {doctor.appointmentsCount} приёмов • {doctor.patientsCount} пациентов
                          {doctor.type === "staff_doctor" && ` • Ставка ${doctor.salaryPercent}%`}
                        </p>
                      </div>
                      <Badge variant="outline" className={doctor.type === "staff_doctor" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}>
                        {doctor.typeName}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-background/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Выручка</p>
                        <p className="text-xl font-bold text-foreground">{doctor.revenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">UZS</p>
                      </div>
                      <div className={`p-4 rounded-lg ${doctor.type === "staff_doctor" ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                        <p className={`text-xs mb-1 ${doctor.type === "staff_doctor" ? "text-amber-400" : "text-emerald-400"}`}>
                          {doctor.type === "staff_doctor" ? "Доход врача" : "Личный доход"}
                        </p>
                        <p className={`text-xl font-bold ${doctor.type === "staff_doctor" ? "text-amber-400" : "text-emerald-400"}`}>
                          {doctor.doctorShare.toLocaleString()}
                        </p>
                        <p className={`text-xs ${doctor.type === "staff_doctor" ? "text-amber-400" : "text-emerald-400"}`}>UZS</p>
                      </div>
                      {doctor.type === "staff_doctor" && (
                        <div className="p-4 bg-emerald-500/10 rounded-lg">
                          <p className="text-xs text-emerald-400 mb-1">Доход клиники</p>
                          <p className="text-xl font-bold text-emerald-400">{doctor.clinicShare.toLocaleString()}</p>
                          <p className="text-xs text-emerald-400">UZS</p>
                        </div>
                      )}
                      <div className="p-4 bg-primary/10 rounded-lg">
                        <p className="text-xs text-primary mb-1">Средний чек</p>
                        <p className="text-xl font-bold text-primary">
                          {doctor.appointmentsCount > 0 ? Math.round(doctor.revenue / doctor.appointmentsCount).toLocaleString() : 0}
                        </p>
                        <p className="text-xs text-primary">UZS</p>
                      </div>
                    </div>

                    {/* Mini Chart */}
                    {doctor.dailyData.length > 0 && (
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={doctor.dailyData}>
                            <defs>
                              <linearGradient id={`gradient-${doctor.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={doctor.type === "staff_doctor" ? "#10b981" : "#f59e0b"} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={doctor.type === "staff_doctor" ? "#10b981" : "#f59e0b"} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke={doctor.type === "staff_doctor" ? "#10b981" : "#f59e0b"}
                              fill={`url(#gradient-${doctor.id})`}
                              strokeWidth={2}
                            />
                            <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => [`${value.toLocaleString()} UZS`, "Выручка"]}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ))}
                {reports?.doctors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет данных за выбранный период</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Staff Model Card */}
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Штатная модель
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-background/30 rounded-lg">
                    <span className="text-muted-foreground">Общая выручка</span>
                    <span className="font-bold text-foreground">{(reports?.comparison.staff.revenue || 0).toLocaleString()} UZS</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-lg">
                    <span className="text-amber-400">Выплаты врачам</span>
                    <span className="font-bold text-amber-400">{(reports?.comparison.staff.doctorShare || 0).toLocaleString()} UZS</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg">
                    <span className="text-emerald-400">Доход клиники</span>
                    <span className="font-bold text-emerald-400">{(reports?.comparison.staff.clinicShare || 0).toLocaleString()} UZS</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-background/30 rounded-lg">
                    <span className="text-muted-foreground">Приёмов</span>
                    <span className="font-bold text-foreground">{reports?.comparison.staff.appointments || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-background/30 rounded-lg">
                    <span className="text-muted-foreground">Пациентов</span>
                    <span className="font-bold text-foreground">{reports?.comparison.staff.patients || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rental Model Card */}
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-400 flex items-center gap-2">
                  <Armchair className="w-5 h-5" />
                  Арендная модель
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-lg">
                    <span className="text-amber-400">Доход от аренды</span>
                    <span className="font-bold text-amber-400">{(reports?.comparison.rental.revenue || 0).toLocaleString()} UZS</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg">
                    <span className="text-emerald-400">Доход клиники</span>
                    <span className="font-bold text-emerald-400">{(reports?.comparison.rental.clinicShare || 0).toLocaleString()} UZS</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-background/30 rounded-lg">
                    <span className="text-muted-foreground">Приёмов (личных)</span>
                    <span className="font-bold text-foreground">{reports?.comparison.rental.appointments || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-background/30 rounded-lg">
                    <span className="text-muted-foreground">Пациентов (личных)</span>
                    <span className="font-bold text-foreground">{reports?.comparison.rental.patients || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                    <span className="text-primary">Чистая прибыль (100%)</span>
                    <span className="font-bold text-primary">{(reports?.comparison.rental.revenue || 0).toLocaleString()} UZS</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Chart */}
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Сравнение доходов клиники
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { 
                      name: "Штат", 
                      value: reports?.comparison.staff.clinicShare || 0,
                      fill: "#10b981"
                    },
                    { 
                      name: "Аренда", 
                      value: reports?.comparison.rental.clinicShare || 0,
                      fill: "#f59e0b"
                    },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} UZS`, "Доход"]}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {[
                        { name: "Штат", fill: "#10b981" },
                        { name: "Аренда", fill: "#f59e0b" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg text-muted-foreground">Общий доход клиники</p>
                  <p className="text-3xl font-bold text-foreground">
                    {((reports?.comparison.staff.clinicShare || 0) + (reports?.comparison.rental.clinicShare || 0)).toLocaleString()} UZS
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-sm text-emerald-400">От штата</p>
                    <p className="text-xl font-bold text-emerald-400">{(reports?.comparison.staff.clinicShare || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-400">От аренды</p>
                    <p className="text-xl font-bold text-amber-400">{(reports?.comparison.rental.clinicShare || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
