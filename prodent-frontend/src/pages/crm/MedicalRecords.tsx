import { CRMLayout } from "@/components/crm/CRMLayout";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMedicalAccess } from "@/hooks/useMedicalAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UltraRealisticDentalChart } from "@/components/patient/dental/UltraRealisticDentalChart";
import { MedicalRecordsList } from "@/components/crm/medical/MedicalRecordsList";
import { MedicalRecordForm } from "@/components/crm/medical/MedicalRecordForm";
import { TreatmentPlansList } from "@/components/crm/treatment/TreatmentPlansList";
import { TreatmentHistory } from "@/components/crm/medical/TreatmentHistory";
import { PatientFiles } from "@/components/crm/PatientFiles";
import { LockedMedicalRecord } from "@/components/medical/LockedMedicalRecord";
import { RequestAccessDialog } from "@/components/medical/RequestAccessDialog";
import { AccessStatusBadge } from "@/components/medical/AccessStatusBadge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Calendar, FileText, Search, Users, ShieldCheck, ShieldX, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getPatientMedicalRecords } from "@/lib/medical-record-api";
import { medicalAccessApi } from "@/lib/medical-access-api";

export default function MedicalRecords() {
  const { t } = useLanguage();
  const { patientId } = useParams();
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Получаем doctor ID для текущего пользователя
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor-for-list", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !patientId,
  });

  // Получаем список пациентов клиники (через записи + доступы к медкартам)
  const { data: patients, isLoading: loadingPatients } = useQuery({
    queryKey: ["clinic-patients", currentClinic?.id, currentDoctor?.id, searchQuery],
    queryFn: async () => {
      const patientIds = new Set<string>();
      
      // 1. Получаем пациентов через appointments (если есть клиника)
      if (currentClinic?.id) {
        const { data: appointments } = await supabase
          .from("appointments")
          .select("patient_id")
          .eq("clinic_id", currentClinic.id);
        
        appointments?.forEach(a => {
          if (a.patient_id) patientIds.add(a.patient_id);
        });
      }
      
      // 2. Получаем пациентов, доступных текущему врачу/клинике, через
      // защищённый backend API. Backend сам определяет права текущего пользователя.
      if (currentDoctor?.id || currentClinic?.id) {
        const accessPatientIds = await medicalAccessApi.patientIds(["active", "pending"]);
        accessPatientIds.forEach((id) => patientIds.add(id));
      }
      
      if (patientIds.size === 0) return [];

      // Получаем профили пациентов
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .in("id", Array.from(patientIds));
      
      let result = profiles || [];
      
      // Фильтруем по поисковому запросу
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        result = result.filter(p => 
          p?.full_name?.toLowerCase().includes(search) ||
          p?.phone?.includes(search)
        );
      }
      
      return result;
    },
    enabled: !patientId && (!!currentClinic?.id || !!currentDoctor?.id),
  });

  // Получаем данные врача
  const { data: doctor } = useQuery({
    queryKey: ["current-doctor"],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user?.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Сначала сервер решает, разрешено ли читать медкарту. До этого момента
  // профиль пациента и медицинские данные не запрашиваются.
  const { data: accessData, isLoading: accessLoading } = useMedicalAccess(
    patientId || undefined,
    doctor?.id,
    currentClinic?.id,
  );
  const hasAccess = accessData?.hasAccess === true;

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient-detail", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId)
        .single();
      return data;
    },
    enabled: !!patientId && hasAccess,
  });

  // Получаем медицинские записи
  const {
    data: medicalRecords,
    isError: isMedicalRecordsError,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: ["medical-records", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const data = await getPatientMedicalRecords(patientId);
      return data.map((record) => ({
        id: record.id,
        visit_date: record.createdAt,
        chief_complaint: record.notes || "",
        examination: null,
        diagnosis: record.diagnosis || "",
        treatment_provided: record.treatment || null,
        anesthesia: record.anesthesia || null,
        recommendations: null,
        next_visit_date: null,
        voice_notes: null,
      }));
    },
    enabled: !!patientId && hasAccess,
  });

  // Проверяем наличие pending запроса
  const { data: pendingRequest } = useQuery({
    queryKey: ['pending-access-request-crm', doctor?.id, patientId, currentClinic?.id],
    queryFn: async () => {
      const requests = await medicalAccessApi.doctorRequests();
      return requests.find((request) =>
        request.patientId === patientId &&
        request.status === "pending" &&
        (doctor?.id
          ? request.doctorId === doctor.id
          : !currentClinic?.id || request.clinicId === currentClinic.id)
      ) || null;
    },
    enabled: !!patientId && (!!doctor?.id || !!currentClinic?.id),
  });

  // Если нет patientId - показываем список пациентов
  if (!patientId) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmMedicalRecords.title")}</h1>
              <p className="text-muted-foreground">{t("crmMedicalRecords.description")}</p>
            </div>

            {/* Поиск */}
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("crmMedicalRecords.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 bg-background border-border"
              />
            </div>
          </div>

          {/* Список пациентов */}
          {loadingPatients ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-28 rounded-2xl bg-muted" />
              ))}
            </div>
          ) : patients && patients.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {patients.map((p) => (
                <Link key={p.id} to={`/crm/medical/${p.id}`}>
                  <Card className="group cursor-pointer border-border/50 bg-card/80 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft">
                    <CardContent className="p-card-x">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 border-2 border-border">
                          <AvatarImage src={p.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {p.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{p.full_name || t("crmMedicalRecords.noName")}</p>
                          {p.phone && (
                            <p className="text-sm text-muted-foreground">{p.phone}</p>
                          )}
                          <p className="mt-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {t("crmMedicalRecords.tabRecords")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="py-16 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {searchQuery ? t("crmMedicalRecords.noPatients") : t("crmMedicalRecords.noPatientsClinic")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </CRMLayout>
    );
  }

  if (accessLoading) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <Skeleton className="h-48 w-full bg-muted" />
        </div>
      </CRMLayout>
    );
  }

  if (!hasAccess) {
    return (
      <CRMLayout>
        <div className="space-y-6 p-6 lg:p-8">
          <Link to="/crm/medical">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("crmMedicalRecords.backToList")}
            </Button>
          </Link>
          <LockedMedicalRecord
            onRequestAccess={() => setShowAccessDialog(true)}
            isPending={!!pendingRequest}
            pendingRequestDate={pendingRequest?.created_at}
          />
          {patientId && (doctor?.id || currentClinic?.id) && (
            <RequestAccessDialog
              open={showAccessDialog}
              onOpenChange={setShowAccessDialog}
              patientId={patientId}
              doctorId={doctor?.id}
              clinicId={currentClinic?.id}
              source="search"
            />
          )}
        </div>
      </CRMLayout>
    );
  }

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <Skeleton className="h-48 w-full bg-muted" />
        </div>
      </CRMLayout>
    );
  }

  if (!patient) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8">
          <Link to="/crm/medical">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("crmMedicalRecords.backToList")}
            </Button>
          </Link>
          <p className="text-muted-foreground">{t("crmMedicalRecords.patientNotFound")}</p>
        </div>
      </CRMLayout>
    );
  }

  const age = patient.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Кнопка назад */}
        <Link to="/crm/medical">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("crmMedicalRecords.backToList")}
          </Button>
        </Link>

        {/* Карточка пациента */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={patient.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                    {patient.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-col gap-2 mb-1 sm:flex-row sm:items-center sm:gap-3">
                    <CardTitle className="text-2xl text-foreground">
                      {patient.full_name || t("crmMedicalRecords.defaultPatient")}
                    </CardTitle>
                    {hasAccess ? (
                      <Badge variant="outline" className="gap-1.5 text-status-success border-status-success/30 bg-status-success-bg">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t("crmMedicalRecords.accessGranted")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                        <ShieldX className="h-3.5 w-3.5" />
                        {t("crmMedicalRecords.noAccess")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {age && <span>{age} {t("crmMedicalRecords.yearsOld")}</span>}
                    {patient.gender && <span>{patient.gender === "male" ? t("crmMedicalRecords.genderMale") : t("crmMedicalRecords.genderFemale")}</span>}
                    {patient.phone && <span>{patient.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!hasAccess && (doctor?.id || currentClinic?.id) && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAccessDialog(true)}
                    className="gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    {t("crmMedicalRecords.requestAccess")}
                  </Button>
                )}
                {hasAccess && doctor?.id && (
                  <Button
                    onClick={() => setShowRecordForm(true)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("crmMedicalRecords.createRecord")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Access Dialog */}
        {patientId && (doctor?.id || currentClinic?.id) && (
          <RequestAccessDialog
            open={showAccessDialog}
            onOpenChange={setShowAccessDialog}
            patientId={patientId}
            patientName={patient.full_name || undefined}
            doctorId={doctor?.id}
            clinicId={currentClinic?.id}
            source="search"
          />
        )}

        {/* Вкладки */}
        <Tabs defaultValue="dental" className="w-full">
          <TabsList className="h-auto flex-wrap gap-0.5">
            <TabsTrigger value="dental" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              {t("crmMedicalRecords.tabDental")}
            </TabsTrigger>
            <TabsTrigger value="plan" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              <Calendar className="w-4 h-4 mr-2" />
              {t("crmMedicalRecords.tabPlan")}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              {t("crmMedicalRecords.tabHistory")}
            </TabsTrigger>
            <TabsTrigger value="records" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              <FileText className="w-4 h-4 mr-2" />
              {t("crmMedicalRecords.tabRecords")}
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              {t("crmMedicalRecords.tabFiles")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dental" className="mt-6">
            <UltraRealisticDentalChart patientId={patientId} birthDate={patient.date_of_birth} />
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            {hasAccess ? (
              currentClinic?.id ? (
                <TreatmentPlansList 
                  patientId={patientId} 
                  doctorId={doctor?.id || ""} 
                  clinicId={currentClinic.id} 
                />
              ) : (
                <Card className="border-border/50">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">{t("crmMedicalRecords.selectClinicForPlans")}</p>
                  </CardContent>
                </Card>
              )
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={!!pendingRequest}
                pendingRequestDate={pendingRequest?.created_at}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {hasAccess ? (
              <TreatmentHistory patientId={patientId} />
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={!!pendingRequest}
                pendingRequestDate={pendingRequest?.created_at}
              />
            )}
          </TabsContent>

          <TabsContent value="records" className="mt-6">
            {hasAccess ? (
              isMedicalRecordsError ? (
                <MedicalRecordsLoadError onRetry={() => void refetchRecords()} />
              ) : (
                <>
                  <MedicalRecordsList records={medicalRecords || []} />
                  <AnesthesiaHistory records={medicalRecords || []} />
                </>
              )
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={!!pendingRequest}
                pendingRequestDate={pendingRequest?.created_at}
              />
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            {hasAccess ? (
              <PatientFiles patientId={patientId} />
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={!!pendingRequest}
                pendingRequestDate={pendingRequest?.created_at}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Форма создания медицинской записи */}
        {doctor && (
          <MedicalRecordForm
            open={showRecordForm}
            onOpenChange={setShowRecordForm}
            patientId={patientId}
            doctorId={doctor.id}
            onSuccess={() => refetchRecords()}
          />
        )}
      </div>
    </CRMLayout>
  );
}

type AnesthesiaRecord = {
  id: string;
  visit_date: string;
  anesthesia: string | null;
};

const MedicalRecordsLoadError = ({ onRetry }: { onRetry: () => void }) => (
  <Card role="alert" className="border-status-danger/40 bg-status-danger-bg">
    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
      <div className="flex items-center gap-2 text-sm font-medium text-status-danger">
        <ShieldX className="h-4 w-4 shrink-0" />
        Медицинские записи не загрузились. Это ошибка загрузки, а не пустая карта.
      </div>
      <Button type="button" variant="outline" onClick={onRetry}>
        Повторить
      </Button>
    </CardContent>
  </Card>
);

const AnesthesiaHistory = ({ records }: { records: AnesthesiaRecord[] }) => {
  const anesthesiaRecords = records.filter((record) => record.anesthesia?.trim());

  if (anesthesiaRecords.length === 0) return null;

  return (
    <Card className="mt-4 border-border/50 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">Анестезия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {anesthesiaRecords.map((record) => (
          <div key={record.id} className="rounded-lg border border-border/60 p-3">
            <div className="mb-1 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(record.visit_date))}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {record.anesthesia}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
