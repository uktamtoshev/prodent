import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  TrendingUp,
  Users,
  Building2,
  User,
  FileText,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import { useState } from "react";

export function DetailedDoctorReport() {
  const { currentClinic } = useClinic();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");

  const periodStart = startOfMonth(new Date(selectedMonth + "-01"));
  const periodEnd = endOfMonth(new Date(selectedMonth + "-01"));

  // Get staff doctors
  const { data: staffDoctors } = useQuery({
    queryKey: ["staff-doctors-list", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          profiles:user_id(full_name, avatar_url)
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get detailed appointments with services
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["detailed-doctor-report", currentClinic?.id, selectedMonth, selectedDoctorId],
    queryFn: async () => {
      if (!staffDoctors?.length) return { appointments: [], byService: [], byDoctor: [], totals: null };

      const doctorIds = selectedDoctorId === "all" 
        ? staffDoctors.map(d => d.id)
        : [selectedDoctorId];

      // Get appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          doctor_id,
          patient_id,
          service,
          price,
          appointment_date,
          status,
          doctor:doctors(id, salary_percent, profiles:user_id(full_name))
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .in("doctor_id", doctorIds)
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString())
        .order("appointment_date", { ascending: false });

      // Group by service
      const serviceMap: Record<string, { 
        service: string; 
        count: number; 
        revenue: number;
        doctorShare: number;
        clinicProfit: number;
      }> = {};

      // Group by doctor
      const doctorMap: Record<string, {
        doctorId: string;
        name: string;
        avatar: string | null;
        percent: number;
        appointments: number;
        revenue: number;
        doctorShare: number;
        clinicProfit: number;
        services: Record<string, { count: number; revenue: number; doctorShare: number }>;
      }> = {};

      let totalRevenue = 0;
      let totalDoctorShare = 0;
      let totalClinicProfit = 0;

      appointments?.forEach((apt) => {
        const doctor = apt.doctor as any;
        const percent = doctor?.salary_percent || 30;
        const price = apt.price || 0;
        const doctorShare = Math.round(price * (percent / 100));
        const clinicProfit = price - doctorShare;

        totalRevenue += price;
        totalDoctorShare += doctorShare;
        totalClinicProfit += clinicProfit;

        // By service
        if (!serviceMap[apt.service]) {
          serviceMap[apt.service] = { 
            service: apt.service, 
            count: 0, 
            revenue: 0,
            doctorShare: 0,
            clinicProfit: 0
          };
        }
        serviceMap[apt.service].count++;
        serviceMap[apt.service].revenue += price;
        serviceMap[apt.service].doctorShare += doctorShare;
        serviceMap[apt.service].clinicProfit += clinicProfit;

        // By doctor
        const doctorId = apt.doctor_id;
        if (!doctorMap[doctorId]) {
          doctorMap[doctorId] = {
            doctorId,
            name: doctor?.profiles?.full_name || "Врач",
            avatar: null,
            percent,
            appointments: 0,
            revenue: 0,
            doctorShare: 0,
            clinicProfit: 0,
            services: {},
          };
        }
        doctorMap[doctorId].appointments++;
        doctorMap[doctorId].revenue += price;
        doctorMap[doctorId].doctorShare += doctorShare;
        doctorMap[doctorId].clinicProfit += clinicProfit;

        if (!doctorMap[doctorId].services[apt.service]) {
          doctorMap[doctorId].services[apt.service] = { count: 0, revenue: 0, doctorShare: 0 };
        }
        doctorMap[doctorId].services[apt.service].count++;
        doctorMap[doctorId].services[apt.service].revenue += price;
        doctorMap[doctorId].services[apt.service].doctorShare += doctorShare;
      });

      return {
        appointments: appointments || [],
        byService: Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue),
        byDoctor: Object.values(doctorMap).sort((a, b) => b.revenue - a.revenue),
        totals: { revenue: totalRevenue, doctorShare: totalDoctorShare, clinicProfit: totalClinicProfit },
      };
    },
    enabled: !!currentClinic?.id && !!staffDoctors?.length,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  const { byService, byDoctor, totals } = reportData || { byService: [], byDoctor: [], totals: null };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
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

        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-[200px] bg-background border-border">
            <SelectValue placeholder="Все врачи" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все врачи</SelectItem>
            {staffDoctors?.map((doctor) => (
              <SelectItem key={doctor.id} value={doctor.id}>
                {(doctor.profiles as any)?.full_name || "Врач"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Общая выручка</p>
                  <p className="text-2xl font-bold text-foreground">{totals.revenue.toLocaleString()} UZS</p>
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
                  <p className="text-sm text-muted-foreground">Доход врачей</p>
                  <p className="text-2xl font-bold text-amber-400">{totals.doctorShare.toLocaleString()} UZS</p>
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
                  <p className="text-sm text-muted-foreground">Доход клиники</p>
                  <p className="text-2xl font-bold text-emerald-400">{totals.clinicProfit.toLocaleString()} UZS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="by-doctor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="by-doctor" className="gap-2">
            <Users className="w-4 h-4" />
            По врачам
          </TabsTrigger>
          <TabsTrigger value="by-service" className="gap-2">
            <FileText className="w-4 h-4" />
            По услугам
          </TabsTrigger>
        </TabsList>

        {/* By Doctor */}
        <TabsContent value="by-doctor" className="space-y-4">
          {byDoctor.map((doctor) => (
            <Card key={doctor.doctorId} className="bg-card/80 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={doctor.avatar || ""} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{doctor.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {doctor.appointments} приёмов • Ставка {doctor.percent}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">{doctor.revenue.toLocaleString()} UZS</p>
                    <p className="text-sm text-muted-foreground">выручка</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Doctor totals */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <p className="text-xs text-amber-400 mb-1">Доход врача</p>
                    <p className="text-lg font-bold text-amber-400">
                      {doctor.doctorShare.toLocaleString()} UZS
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <p className="text-xs text-emerald-400 mb-1">Доход клиники</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {doctor.clinicProfit.toLocaleString()} UZS
                    </p>
                  </div>
                </div>

                {/* Services breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Детализация по услугам:</p>
                  {Object.entries(doctor.services).map(([service, data]) => {
                    const serviceData = data as { count: number; revenue: number; doctorShare: number };
                    return (
                      <div
                        key={service}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            {serviceData.count}×
                          </Badge>
                          <span className="text-foreground">{service}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{serviceData.revenue.toLocaleString()}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-amber-400">{serviceData.doctorShare.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {byDoctor.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет данных за выбранный период</p>
            </div>
          )}
        </TabsContent>

        {/* By Service */}
        <TabsContent value="by-service">
          <Card className="bg-card/80 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Детализация по услугам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byService.length > 0 ? (
                <div className="space-y-3">
                  {byService.map((item) => (
                    <div
                      key={item.service}
                      className="p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-foreground">{item.service}</p>
                          <p className="text-sm text-muted-foreground">{item.count} приёмов</p>
                        </div>
                        <p className="text-xl font-bold text-foreground">
                          {item.revenue.toLocaleString()} UZS
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 bg-amber-500/10 rounded flex items-center justify-between">
                          <span className="text-xs text-amber-400">Врачам</span>
                          <span className="font-semibold text-amber-400">
                            {item.doctorShare.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded flex items-center justify-between">
                          <span className="text-xs text-emerald-400">Клинике</span>
                          <span className="font-semibold text-emerald-400">
                            {item.clinicProfit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет данных за выбранный период</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}