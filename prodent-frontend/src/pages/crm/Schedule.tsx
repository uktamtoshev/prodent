import { useState } from "react";
import { Plus } from "lucide-react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PermissionGate } from "@/components/crm/PermissionGate";
import { Button } from "@/components/ui/button";
import { GuestAppointmentModal } from "@/components/crm/appointments/GuestAppointmentModal";
import { ScheduleHeader, ViewMode } from "@/components/crm/scheduling/ScheduleHeader";
import { DayScheduleView } from "@/components/crm/scheduling/DayScheduleView";
import { WeekScheduleView } from "@/components/crm/scheduling/WeekScheduleView";
import { MonthScheduleView } from "@/components/crm/scheduling/MonthScheduleView";
import { RoomScheduleView } from "@/components/crm/scheduling/RoomScheduleView";
import { FloatingAddButton } from "@/components/crm/scheduling/FloatingAddButton";
import { useClinic } from "@/contexts/ClinicContext";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";

const Schedule = () => {
  const { currentClinic } = useClinic();
  const { data: clinicDoctors = [] } = useClinicDoctors();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const doctors = clinicDoctors.map(d => ({
    id: d.id,
    profiles: d.profiles ? { full_name: d.profiles.full_name } : null,
  }));

  return (
    <CRMLayout>
      <PermissionGate module="schedule">
      <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Расписание</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Управление записями и расписанием врачей
            </p>
          </div>
          {/* Desktop Add Button */}
          <Button 
            onClick={() => setIsCreateDialogOpen(true)} 
            className="hidden lg:flex bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 gap-2"
          >
            <Plus className="h-4 w-4" />
            Новая запись
          </Button>
        </div>

        {/* Schedule Header with Filters */}
        <ScheduleHeader
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDoctor={selectedDoctor}
          onDoctorChange={setSelectedDoctor}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          doctors={doctors}
        />

        {/* View Content */}
        {viewMode === "day" && (
          <DayScheduleView
            selectedDate={selectedDate}
            searchQuery={searchQuery}
            selectedDoctor={selectedDoctor}
            selectedStatus={selectedStatus}
          />
        )}
        {viewMode === "week" && (
          <WeekScheduleView
            selectedDate={selectedDate}
            searchQuery={searchQuery}
            selectedDoctor={selectedDoctor}
            selectedStatus={selectedStatus}
          />
        )}
        {viewMode === "month" && (
          <MonthScheduleView
            selectedDate={selectedDate}
            searchQuery={searchQuery}
            selectedDoctor={selectedDoctor}
            selectedStatus={selectedStatus}
          />
        )}
        {viewMode === "rooms" && (
          <RoomScheduleView
            selectedDate={selectedDate}
            searchQuery={searchQuery}
            selectedDoctor={selectedDoctor}
            selectedStatus={selectedStatus}
          />
        )}

        {/* Floating Add Button for Mobile */}
        <FloatingAddButton onClick={() => setIsCreateDialogOpen(true)} />

        {/* Create Appointment Dialog */}
        <GuestAppointmentModal
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          selectedDate={selectedDate}
        />
      </div>
      </PermissionGate>
    </CRMLayout>
  );
};

export default Schedule;
