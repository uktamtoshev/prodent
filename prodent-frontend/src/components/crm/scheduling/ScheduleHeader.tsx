import { format, addDays, addWeeks, addMonths, startOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, List, Search, X, DoorOpen } from "lucide-react";
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
import { APPOINTMENT_STATUSES, AppointmentStatus } from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";

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
  const handlePrevious = () => {
    if (viewMode === "day") {
      onDateChange(addDays(selectedDate, -1));
    } else if (viewMode === "week") {
      onDateChange(addWeeks(selectedDate, -1));
    } else {
      onDateChange(addMonths(selectedDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
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
    if (viewMode === "day") {
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
    <div className="space-y-4">
      {/* Top row: Navigation and View Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="h-9 w-9 shrink-0 border-neutral-200 dark:border-neutral-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleToday}
            className="h-9 px-3 text-sm border-neutral-200 dark:border-neutral-700"
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-9 w-9 shrink-0 border-neutral-200 dark:border-neutral-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold text-foreground capitalize whitespace-nowrap">
            {getDateRangeText()}
          </h2>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)} className="shrink-0">
          <TabsList className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <TabsTrigger 
              value="day" 
              className="gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">День</span>
            </TabsTrigger>
            <TabsTrigger 
              value="week" 
              className="gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Неделя</span>
            </TabsTrigger>
            <TabsTrigger 
              value="month" 
              className="gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:shadow-sm"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Месяц</span>
            </TabsTrigger>
            <TabsTrigger 
              value="rooms" 
              className="gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700 data-[state=active]:shadow-sm"
            >
              <DoorOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Кабинеты</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bottom row: Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск пациента или услуги..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9 h-10 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedDoctor} onValueChange={onDoctorChange}>
            <SelectTrigger className="w-[160px] h-10 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
              <SelectValue placeholder="Все врачи" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все врачи</SelectItem>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.profiles?.full_name || "Врач"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[160px] h-10 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", {
                      "bg-blue-500": key === "pending",
                      "bg-indigo-500": key === "confirmed",
                      "bg-green-500": key === "completed",
                      "bg-red-500": key === "cancelled",
                    })} />
                    {value.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Legend - Mobile friendly */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", {
              "bg-blue-500": key === "pending",
              "bg-indigo-500": key === "confirmed",
              "bg-green-500": key === "completed",
              "bg-red-500": key === "cancelled",
            })} />
            <span>{value.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
