import { CRMLayout } from "@/components/crm/CRMLayout";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
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

export default function MedicalRecords() {
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
      
      // 2. Получаем пациентов через активные medical_record_access для врача
      if (currentDoctor?.id) {
        const { data: accessRecords } = await supabase
          .from("medical_record_access")
          .select("patient_id")
          .eq("doctor_id", currentDoctor.id)
          .in("status", ["active", "pending"]);
        
        accessRecords?.forEach(a => {
          if (a.patient_id) patientIds.add(a.patient_id);
        });
      }
      
      // 3. Получаем пациентов через активные medical_record_access для клиники
      if (currentClinic?.id) {
        const { data: clinicAccess } = await supabase
          .from("medical_record_access")
          .select("patient_id")
          .eq("clinic_id", currentClinic.id)
          .in("status", ["active", "pending"]);
        
        clinicAccess?.forEach(a => {
          if (a.patient_id) patientIds.add(a.patient_id);
        });
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

  // Получаем данные пациента
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
    enabled: !!patientId,
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

  // Получаем медицинские записи
  const { data: medicalRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["medical-records", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data } = await supabase
        .from("medical_records")
        .select("*")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      return data || [];
    },
    enabled: !!patientId,
  });

  // Проверяем доступ к медкарте
  const { data: accessData, isLoading: accessLoading } = useMedicalAccess(
    patientId || undefined, 
    doctor?.id, 
    currentClinic?.id
  );

  // Проверяем наличие pending запроса
  const { data: pendingRequest } = useQuery({
    queryKey: ['pending-access-request-crm', doctor?.id, patientId, currentClinic?.id],
    queryFn: async () => {
      let query = supabase
        .from('medical_record_access')
        .select('*')
        .eq('patient_id', patientId!)
        .eq('status', 'pending');
      
      if (doctor?.id) {
        query = query.eq('doctor_id', doctor.id);
      } else if (currentClinic?.id) {
        query = query.eq('clinic_id', currentClinic.id);
      }
      
      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: !!patientId && (!!doctor?.id || !!currentClinic?.id),
  });

  const hasAccess = accessData?.hasAccess;

  // Если нет patientId - показываем список пациентов
  if (!patientId) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="font-heading text-foreground">Медкарты пациентов</h1>
            <p className="text-muted-foreground">Выберите пациента для просмотра медкарты</p>
          </div>

          {/* Поиск */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>

          {/* Список пациентов */}
          {loadingPatients ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-24 bg-muted" />
              ))}
            </div>
          ) : patients && patients.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {patients.map((p: any) => (
                <Link key={p.id} to={`/crm/medical/${p.id}`}>
                  <Card className="bg-card/80 border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 border-2 border-border">
                          <AvatarImage src={p.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {p.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "П"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{p.full_name || "Без имени"}</p>
                          {p.phone && (
                            <p className="text-sm text-muted-foreground">{p.phone}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="bg-card/80 border-border/50">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Пациенты не найдены" : "Нет пациентов в клинике"}
                </p>
              </CardContent>
            </Card>
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
              Назад к списку
            </Button>
          </Link>
          <p className="text-muted-foreground">Пациент не найден</p>
        </div>
      </CRMLayout>
    );
  }

  const age = patient.birth_date
    ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear()
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
            Назад к списку
          </Button>
        </Link>

        {/* Карточка пациента */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-border">
                  <AvatarImage src={patient.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {patient.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "П"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-2xl text-foreground">
                      {patient.full_name || "Пациент"}
                    </CardTitle>
                    {hasAccess ? (
                      <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Доступ открыт
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                        <ShieldX className="h-3.5 w-3.5" />
                        Нет доступа
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {age && <span>{age} лет</span>}
                    {patient.gender && <span>{patient.gender === "male" ? "М" : "Ж"}</span>}
                    {patient.phone && <span>{patient.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {!hasAccess && (doctor?.id || currentClinic?.id) && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAccessDialog(true)}
                    className="gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    Запросить доступ
                  </Button>
                )}
                {hasAccess && (
                  <Button
                    onClick={() => setShowRecordForm(true)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать запись
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
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="dental" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              Зубная формула
            </TabsTrigger>
            <TabsTrigger value="plan" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              <Calendar className="w-4 h-4 mr-2" />
              План лечения
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              История процедур
            </TabsTrigger>
            <TabsTrigger value="records" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              <FileText className="w-4 h-4 mr-2" />
              Записи врача
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary" disabled={!hasAccess}>
              Файлы и снимки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dental" className="mt-6">
            {hasAccess ? (
              <UltraRealisticDentalChart patientId={patientId} birthDate={patient.birth_date} />
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={!!pendingRequest}
                pendingRequestDate={pendingRequest?.created_at}
              />
            )}
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
                    <p className="text-muted-foreground">Выберите клинику для просмотра планов лечения</p>
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
              <MedicalRecordsList records={medicalRecords || []} />
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
