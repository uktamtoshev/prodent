import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  Filter,
  List,
  Search,
  X,
  DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPOINTMENT_STATUSES,
  AppointmentStatus,
} from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type ViewMode = "day" | "week" | "rooms" | "month";

interface Doctor {
  id: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface ScheduleHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDoctor: string;
  onDoctorChange: (doctorId: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  doctors: Doctor[];
}

export const ScheduleHeader = ({
  selectedDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  selectedDoctor,
  onDoctorChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  doctors,
}: ScheduleHeaderProps) => {
  const { t } = useLanguage();
  const handlePrevious = () => {
    if (viewMode === "day" || viewMode === "rooms") {
      onDateChange(addDays(selectedDate, -1));
    } else if (viewMode === "week") {
      onDateChange(addWeeks(selectedDate, -1));
    } else {
      onDateChange(addMonths(selectedDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day" || viewMode === "rooms") {
      onDateChange(addDays(selectedDate, 1));
    } else if (viewMode === "week") {
      onDateChange(addWeeks(selectedDate, 1));
    } else {
      onDateChange(addMonths(selectedDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getDateRangeText = () => {
    if (viewMode === "day" || viewMode === "rooms") {
      return format(selectedDate, "d MMMM yyyy, EEEE", { locale: ru });
    } else if (viewMode === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      return `${format(start, "d MMM", { locale: ru })} – ${format(end, "d MMM yyyy", { locale: ru })}`;
    } else {
      return format(selectedDate, "LLLL yyyy", { locale: ru });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card/80 p-3 shadow-soft backdrop-blur-sm sm:p-4">
      {/* Top row: Navigation and View Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Date Navigation */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="h-10 w-10 shrink-0 rounded-xl border-border/60 bg-background/80"
            aria-label={t("crmScheduleHeader.previousPeriod")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleToday}
            className="h-10 rounded-xl border-border/60 bg-background/80 px-4 text-sm"
          >
            {t("crmScheduleHeader.today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-10 w-10 shrink-0 rounded-xl border-border/60 bg-background/80"
            aria-label={t("crmScheduleHeader.nextPeriod")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="min-w-full pt-1 text-base font-semibold capitalize text-foreground sm:ml-2 sm:min-w-0 sm:pt-0 sm:text-lg">
            {getDateRangeText()}
          </h2>
        </div>

        {/* View Mode Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => onViewModeChange(v as ViewMode)}
          className="w-full shrink-0 lg:w-auto"
        >
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-2xl border border-border/60 bg-muted/60 p-1 lg:flex lg:w-auto">
            <TabsTrigger
              value="day"
              className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("crmScheduleHeader.day")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("crmScheduleHeader.week")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="month"
              className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("crmScheduleHeader.month")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="rooms"
              className="gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <DoorOpen className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("crmScheduleHeader.rooms")}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bottom row: Search and Filters */}
      <div className="grid gap-3 rounded-2xl border border-border/50 bg-background/60 p-2 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("crmScheduleHeader.searchPatient")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 rounded-xl border-border/60 bg-card pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg"
              aria-label={t("crmScheduleHeader.searchPatient")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <div className="hidden h-11 items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:flex">
            <Filter className="h-4 w-4" />
          </div>
          <Select value={selectedDoctor} onValueChange={onDoctorChange}>
            <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-card sm:w-[190px]">
              <SelectValue placeholder={t("crmScheduleHeader.filterDoctor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("crmScheduleHeader.filterDoctor")}
              </SelectItem>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.profiles?.full_name ||
                    t("crmScheduleHeader.doctorFallback")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-card sm:w-[190px]">
              <SelectValue placeholder={t("crmScheduleHeader.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("crmScheduleHeader.allStatuses")}
              </SelectItem>
              {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn("h-2 w-2 rounded-full", {
                        "bg-blue-500": key === "pending",
                        "bg-indigo-500": key === "confirmed",
                        "bg-violet-500": key === "in_progress",
                        "bg-green-500": key === "completed",
                        "bg-red-500": key === "cancelled",
                        "bg-amber-500": key === "no_show",
                      })}
                    />
                    {value.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Legend - Mobile friendly */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 p-2 text-xs text-muted-foreground">
        {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
          <div
            key={key}
            className="flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-1 ring-1 ring-border/40"
          >
            <div
              className={cn("h-2.5 w-2.5 rounded-full", {
                "bg-blue-500": key === "pending",
                "bg-indigo-500": key === "confirmed",
                "bg-violet-500": key === "in_progress",
                "bg-green-500": key === "completed",
                "bg-red-500": key === "cancelled",
                "bg-amber-500": key === "no_show",
              })}
            />
            <span>{value.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
