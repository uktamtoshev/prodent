import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  Search, 
  Download, 
  CalendarCheck, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  appointment_date: string;
  service: string;
  price: number | null;
  status: string;
  notes: string | null;
  doctor_id: string;
  patient_id: string;
  doctor?: {
    id: string;
    user_id: string;
    profiles?: {
      first_name: string | null;
      last_name: string | null;
    };
  };
  patient?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
}

interface FinanceAppointmentsTableProps {
  appointments: Appointment[];
  currency: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function FinanceAppointmentsTable({ appointments, currency }: FinanceAppointmentsTableProps) {
  const currencyLabel = currency === "USD" ? "$" : "сум";
  
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Extract unique doctors and services for filters
  const { doctors, services } = useMemo(() => {
    const doctorsMap = new Map<string, string>();
    const servicesSet = new Set<string>();

    appointments.forEach(a => {
      const doctorName = a.doctor?.profiles 
        ? `${a.doctor.profiles.first_name || ''} ${a.doctor.profiles.last_name || ''}`.trim()
        : "Врач";
      doctorsMap.set(a.doctor_id, doctorName);
      if (a.service) servicesSet.add(a.service);
    });

    return {
      doctors: Array.from(doctorsMap.entries()).map(([id, name]) => ({ id, name })),
      services: Array.from(servicesSet),
    };
  }, [appointments]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const patientName = `${a.patient?.first_name || ''} ${a.patient?.last_name || ''}`.toLowerCase();
      const doctorName = `${a.doctor?.profiles?.first_name || ''} ${a.doctor?.profiles?.last_name || ''}`.toLowerCase();
      const searchLower = search.toLowerCase();

      const matchesSearch = !search || 
        patientName.includes(searchLower) ||
        doctorName.includes(searchLower) ||
        a.service?.toLowerCase().includes(searchLower) ||
        a.patient?.phone?.includes(search);

      const matchesDoctor = doctorFilter === "all" || a.doctor_id === doctorFilter;
      const matchesService = serviceFilter === "all" || a.service === serviceFilter;

      return matchesSearch && matchesDoctor && matchesService;
    });
  }, [appointments, search, doctorFilter, serviceFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalRevenue = filteredAppointments.reduce((sum, a) => sum + (a.price || 0), 0);

  const hasFilters = search || doctorFilter !== "all" || serviceFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDoctorFilter("all");
    setServiceFilter("all");
    setCurrentPage(1);
  };

  const exportToCsv = () => {
    const headers = ["Дата", "Пациент", "Телефон", "Врач", "Услуга", "Сумма"];
    const rows = filteredAppointments.map(a => [
      format(parseISO(a.appointment_date), "dd.MM.yyyy HH:mm"),
      `${a.patient?.first_name || ''} ${a.patient?.last_name || ''}`.trim(),
      a.patient?.phone || "",
      `${a.doctor?.profiles?.first_name || ''} ${a.doctor?.profiles?.last_name || ''}`.trim(),
      a.service || "",
      a.price?.toString() || "0",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `appointments_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-violet-500" />
            Завершённые приёмы
            <Badge variant="secondary" className="ml-2 font-normal">
              {filteredAppointments.length}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 w-[180px] h-9 bg-background/50"
              />
            </div>
            
            <Select value={doctorFilter} onValueChange={v => { setDoctorFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-9 bg-background/50">
                <SelectValue placeholder="Все врачи" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все врачи</SelectItem>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={serviceFilter} onValueChange={v => { setServiceFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-9 bg-background/50">
                <SelectValue placeholder="Все услуги" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все услуги</SelectItem>
                {services.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Сброс
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCsv}
              className="h-9 gap-1.5"
            >
              <Download className="w-4 h-4" />
              Экспорт
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Нет завершённых приёмов за выбранный период</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Дата</TableHead>
                    <TableHead className="font-semibold">Пациент</TableHead>
                    <TableHead className="font-semibold">Врач</TableHead>
                    <TableHead className="font-semibold">Услуга</TableHead>
                    <TableHead className="font-semibold text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAppointments.map((appointment, idx) => (
                    <TableRow 
                      key={appointment.id}
                      className={cn(
                        "transition-colors",
                        idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                      )}
                    >
                      <TableCell className="font-medium">
                        {format(parseISO(appointment.appointment_date), "dd MMM yyyy, HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {appointment.patient?.first_name} {appointment.patient?.last_name}
                          </span>
                          {appointment.patient?.phone && (
                            <span className="block text-xs text-muted-foreground">
                              {appointment.patient.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {appointment.doctor?.profiles?.first_name} {appointment.doctor?.profiles?.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {appointment.service}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(appointment.price, currencyLabel, false)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer with pagination and totals */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Показано {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredAppointments.length)} из {filteredAppointments.length}
                </span>
                <Select 
                  value={itemsPerPage.toString()} 
                  onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                >
                  <SelectTrigger className="w-[80px] h-8 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  Итого: <span className="text-foreground">{formatPrice(totalRevenue, currencyLabel, false)}</span>
                </span>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <span className="px-3 text-sm">
                    {currentPage} / {totalPages || 1}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
