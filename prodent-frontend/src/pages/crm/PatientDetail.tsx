import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Phone,
  Calendar,
  User,
  FileText,
  CreditCard,
  Stethoscope,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { UltraRealisticDentalChart } from "@/components/patient/dental/UltraRealisticDentalChart";
import { VisitHistory } from "@/components/crm/VisitHistory";
import { PatientFiles } from "@/components/crm/PatientFiles";
import { PatientTags } from "@/components/crm/PatientTags";
import { PatientProfile } from "@/components/crm/patients/PatientProfile";
import { PatientPaymentHistory } from "@/components/crm/patients/PatientPaymentHistory";
import { PatientFinanceTab } from "@/components/crm/patients/PatientFinanceTab";
import { useClinic } from "@/contexts/ClinicContext";

export default function PatientDetail() {
  const { id } = useParams();
  const { currentClinic } = useClinic();

  // Получаем данные пациента
  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient-detail", id],
    queryFn: async () => {
      if (!id) return null;

      const { data } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          email,
          avatar_url,
          created_at,
          birth_date,
          gender,
          address,
          notes,
          patient_tags (
            id,
            tag,
            clinic_id
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (!data) return null;

      // Фильтруем теги по текущей клинике
      return {
        ...data,
        patient_tags: currentClinic?.id 
          ? (data.patient_tags as any[])?.filter(t => t.clinic_id === currentClinic.id) || []
          : data.patient_tags
      };
    },
    enabled: !!id,
  });

  // Получаем статистику пациента
  const { data: stats } = useQuery({
    queryKey: ["patient-stats", id, currentClinic?.id],
    queryFn: async () => {
      if (!id) return null;

      let query = supabase
        .from("appointments")
        .select("id, price, status")
        .eq("patient_id", id)
        .eq("status", "completed");

      if (currentClinic?.id) {
        query = query.eq("clinic_id", currentClinic.id);
      }

      const { data: visits } = await query;

      const totalSpent = visits?.reduce((sum, v) => sum + (v.price || 0), 0) || 0;
      const visitCount = visits?.length || 0;

      return {
        visitCount,
        totalSpent,
      };
    },
    enabled: !!id,
  });

  const getInitials = (name: string | null) => {
    if (!name) return "П";
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-12 w-64 bg-muted" />
          <Skeleton className="h-48 w-full bg-muted" />
          <Skeleton className="h-96 w-full bg-muted" />
        </div>
      </CRMLayout>
    );
  }

  if (!patient) {
    return (
      <CRMLayout>
        <div className="p-6 lg:p-8">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">Пациент не найден</p>
              <Link to="/crm/patients">
                <Button variant="outline" className="mt-4 border-border">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Вернуться к списку
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Хедер */}
        <div>
          <Link to="/crm/patients">
            <Button
              variant="ghost"
              className="mb-4 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к списку пациентов
            </Button>
          </Link>
        </div>

        {/* Информация о пациенте */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-border/50">
                <AvatarImage src={patient.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {getInitials(patient.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {patient.full_name || "Без имени"}
                </h1>
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-3">
                  {patient.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                  {patient.created_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Пациент с {format(new Date(patient.created_at), "dd.MM.yyyy", { locale: ru })}
                      </span>
                    </div>
                  )}
                </div>
                <PatientTags patientId={patient.id} tags={patient.patient_tags as any[]} />
              </div>

              <div className="flex flex-col gap-2 text-right">
                <div className="text-sm text-muted-foreground">Всего визитов</div>
                <div className="text-2xl font-bold text-foreground">{stats?.visitCount || 0}</div>
                <div className="text-sm text-muted-foreground">Потрачено</div>
                <div className="text-xl font-semibold text-primary">
                  {(stats?.totalSpent || 0).toLocaleString()} UZS
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Вкладки с детальной информацией */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <User className="w-4 h-4" />
              Профиль
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileText className="w-4 h-4" />
              История визитов
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <CreditCard className="w-4 h-4" />
              История оплат
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <CreditCard className="w-4 h-4" />
              Финансы
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Stethoscope className="w-4 h-4" />
              Медкарта
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <ImageIcon className="w-4 h-4" />
              Файлы и снимки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <PatientProfile patient={patient} />
          </TabsContent>

          <TabsContent value="history">
            <VisitHistory patientId={patient.id} />
          </TabsContent>

          <TabsContent value="payments">
            <PatientPaymentHistory patientId={patient.id} />
          </TabsContent>

          <TabsContent value="finance">
            <PatientFinanceTab patientId={patient.id} />
          </TabsContent>

          <TabsContent value="chart">
            <UltraRealisticDentalChart patientId={patient.id} birthDate={patient.birth_date} />
          </TabsContent>

          <TabsContent value="files">
            <PatientFiles patientId={patient.id} />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
