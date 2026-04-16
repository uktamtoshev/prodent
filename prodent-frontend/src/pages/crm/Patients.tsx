import { CRMLayout } from "@/components/crm/CRMLayout";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X, LayoutGrid, List, Filter, ChevronDown, ChevronUp, UserCheck, Building2 } from "lucide-react";
import { AddPatientDialog } from "@/components/crm/AddPatientDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PatientCardView } from "@/components/crm/patients/PatientCardView";
import { PatientTableView } from "@/components/crm/patients/PatientTableView";
import { PatientsEmptyState } from "@/components/crm/patients/PatientsEmptyState";
import { TagFilterButton } from "@/components/crm/patients/PatientTagBadge";
import { PaginationControls } from "@/components/crm/patients/PaginationControls";

type ViewMode = "cards" | "table";

export default function Patients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [patientView, setPatientView] = useState<"clinic" | "personal">("clinic");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  
  const { currentClinic, loading: clinicLoading } = useClinic();
  const { isDoctor, isSuperAdmin, isClinicAdmin, isClinicManager } = useUserRole();
  const { user } = useAuth();

  // Get current doctor info (for chair rental)
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id, cooperation_type, user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isDoctor,
  });

  const isChairRental = currentDoctor?.cooperation_type === "chair_rental";
  const canViewAllPatients = isSuperAdmin || isClinicAdmin || isClinicManager;

  // Get clinic patients (only for staff doctors and admins)
  const { data: clinicPatients, isLoading: clinicLoading2 } = useQuery({
    queryKey: ["clinic-patients", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic.id)
        .eq("role", "patient")
        .is("assigned_doctor_id", null);

      if (!members || members.length === 0) return [];

      const patientIds = members.map(m => m.user_id);

      const { data } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          avatar_url,
          created_at,
          gender,
          birth_date,
          patient_tags (
            id,
            tag,
            clinic_id
          )
        `)
        .in("id", patientIds);

      return (data || []).map(p => ({
        ...p,
        patient_tags: (p.patient_tags as any[])?.filter(t => t.clinic_id === currentClinic.id) || [],
        patientType: "clinic" as const
      }));
    },
    enabled: !clinicLoading && !!currentClinic?.id && (canViewAllPatients || !isChairRental),
  });

  // Get personal patients for chair rental doctors
  const { data: personalPatients, isLoading: personalLoading } = useQuery({
    queryKey: ["personal-patients", currentClinic?.id, currentDoctor?.id],
    queryFn: async () => {
      if (!currentClinic?.id || !currentDoctor?.id) return [];

      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic.id)
        .eq("role", "patient")
        .eq("assigned_doctor_id", currentDoctor.id);

      if (!members || members.length === 0) return [];

      const patientIds = members.map(m => m.user_id);

      const { data } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          avatar_url,
          created_at,
          gender,
          birth_date,
          patient_tags (
            id,
            tag,
            clinic_id
          )
        `)
        .in("id", patientIds);

      return (data || []).map(p => ({
        ...p,
        patient_tags: (p.patient_tags as any[])?.filter(t => t.clinic_id === currentClinic.id) || [],
        patientType: "personal" as const
      }));
    },
    enabled: !clinicLoading && !!currentClinic?.id && !!currentDoctor?.id && isChairRental,
  });

  // Combine patients based on role
  const patients = useMemo(() => {
    if (isChairRental && !canViewAllPatients) {
      return personalPatients || [];
    }
    if (canViewAllPatients) {
      if (patientView === "personal" && currentDoctor?.id) {
        return personalPatients || [];
      }
      return clinicPatients || [];
    }
    return clinicPatients || [];
  }, [clinicPatients, personalPatients, isChairRental, canViewAllPatients, patientView, currentDoctor?.id]);

  const isLoading = clinicLoading2 || personalLoading;

  // Tag counts
  const tags = useMemo(() => {
    const allTags = [
      { value: "all", label: "Все", count: patients?.length || 0 },
      { value: "VIP", label: "VIP", count: 0 },
      { value: "Дети", label: "Дети", count: 0 },
      { value: "Аллергия", label: "Аллергия", count: 0 },
      { value: "Долг", label: "Долг", count: 0 },
      { value: "Постоянный", label: "Постоянный", count: 0 },
      { value: "Новый", label: "Новый", count: 0 },
    ];

    if (patients) {
      allTags.forEach(tag => {
        if (tag.value !== "all") {
          tag.count = patients.filter(p => 
            (p.patient_tags as any[])?.some(t => t.tag === tag.value)
          ).length;
        }
      });
    }

    return allTags;
  }, [patients]);

  // Filter patients
  const filteredPatients = useMemo(() => {
    if (!patients) return [];

    return patients.filter(patient => {
      // Search by name and phone
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = patient.full_name?.toLowerCase().includes(query);
        const phoneMatch = patient.phone?.includes(query);
        if (!nameMatch && !phoneMatch) return false;
      }

      // Tag filter
      if (selectedTag !== "all") {
        const hasTag = (patient.patient_tags as any[])?.some(t => t.tag === selectedTag);
        if (!hasTag) return false;
      }

      // Gender filter
      if (selectedGender !== "all" && patient.gender !== selectedGender) {
        return false;
      }

      // Age filter
      if (ageFrom || ageTo) {
        if (!patient.birth_date) return false;
        const birthDate = new Date(patient.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (ageFrom && age < parseInt(ageFrom)) return false;
        if (ageTo && age > parseInt(ageTo)) return false;
      }

      // Date filter
      if (dateFrom || dateTo) {
        if (!patient.created_at) return false;
        const createdAt = new Date(patient.created_at);
        if (dateFrom && createdAt < new Date(dateFrom)) return false;
        if (dateTo && createdAt > new Date(dateTo + "T23:59:59")) return false;
      }

      return true;
    });
  }, [patients, searchQuery, selectedTag, selectedGender, ageFrom, ageTo, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / pageSize);
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTag, selectedGender, ageFrom, ageTo, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedTag("all");
    setSelectedGender("all");
    setAgeFrom("");
    setAgeTo("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = selectedGender !== "all" || !!ageFrom || !!ageTo || !!dateFrom || !!dateTo || !!searchQuery || selectedTag !== "all";
  const hasAdvancedFilters = selectedGender !== "all" || !!ageFrom || !!ageTo || !!dateFrom || !!dateTo;

  return (
    <CRMLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Пациенты</h1>
              {isChairRental && !canViewAllPatients && (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Личные пациенты
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {currentClinic 
                ? `${currentClinic.name} • ${filteredPatients.length} пациентов` 
                : "Выберите клинику"}
            </p>
          </div>
          <Button
            onClick={() => setAddPatientOpen(true)}
            disabled={!currentClinic}
            className="gap-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900"
          >
            <Plus className="w-4 h-4" />
            {isChairRental ? "Добавить своего пациента" : "Добавить пациента"}
          </Button>
        </div>

        {/* View toggle for admins who are also chair rental doctors */}
        {canViewAllPatients && isDoctor && isChairRental && (
          <Tabs value={patientView} onValueChange={(v) => setPatientView(v as "clinic" | "personal")}>
            <TabsList className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <TabsTrigger value="clinic" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700">
                <Building2 className="w-4 h-4" />
                Пациенты клиники
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-700">
                <UserCheck className="w-4 h-4" />
                Мои пациенты
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Search and View Toggle */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearFilters}
                className="gap-1.5 border-neutral-200 dark:border-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
                Сбросить
              </Button>
            )}
            <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none border-l border-neutral-200 dark:border-neutral-700"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagFilterButton
              key={tag.value}
              tag={tag.value}
              label={tag.label}
              count={tag.count}
              selected={selectedTag === tag.value}
              onClick={() => setSelectedTag(tag.value)}
            />
          ))}
        </div>

        {/* Advanced Filters */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Filter className="w-4 h-4" />
              Расширенные фильтры
              {hasAdvancedFilters && (
                <Badge variant="secondary" className="ml-1 text-[10px]">Активны</Badge>
              )}
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Пол</Label>
                  <Select value={selectedGender} onValueChange={setSelectedGender}>
                    <SelectTrigger className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="male">Мужской</SelectItem>
                      <SelectItem value="female">Женский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Возраст</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="От"
                      value={ageFrom}
                      onChange={(e) => setAgeFrom(e.target.value)}
                      className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                      min="0"
                      max="120"
                    />
                    <Input
                      type="number"
                      placeholder="До"
                      value={ageTo}
                      onChange={(e) => setAgeTo(e.target.value)}
                      className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                      min="0"
                      max="120"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Добавлен с</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Добавлен до</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Patient List */}
        {isLoading || clinicLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-xl" />
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          <PatientsEmptyState 
            onAddPatient={() => setAddPatientOpen(true)}
            isFiltered={hasActiveFilters}
            isPersonalPatients={isChairRental && !canViewAllPatients}
          />
        ) : (
          <>
            {viewMode === "cards" ? (
              <PatientCardView patients={paginatedPatients} />
            ) : (
              <PatientTableView patients={paginatedPatients} />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredPatients.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </>
        )}

        <AddPatientDialog
          open={addPatientOpen}
          onOpenChange={setAddPatientOpen}
        />
      </div>
    </CRMLayout>
  );
}
