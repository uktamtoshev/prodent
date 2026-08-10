import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useMedicalAccess } from '@/hooks/useMedicalAccess';
import { RequestAccessDialog } from '@/components/medical/RequestAccessDialog';
import { LockedMedicalRecord } from '@/components/medical/LockedMedicalRecord';
import { UltraRealisticDentalChart } from '@/components/patient/dental/UltraRealisticDentalChart';
import { TreatmentHistory } from '@/components/crm/medical/TreatmentHistory';
import { PatientFiles } from '@/components/crm/PatientFiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  ShieldCheck,
  ShieldX,
  FileHeart,
  Activity,
  FolderOpen,
  History,
  MessageSquare,
  User,
  Shield,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function DoctorPatientProfile() {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  // Получаем doctorId
  const { data: doctor } = useQuery({
    queryKey: ['current-doctor', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // useMedicalAccess now returns the latest request of any status with a
  // derived `hasAccess`, so a separate "pending" query is no longer needed.
  const { data: accessData, isLoading: accessLoading } = useMedicalAccess(patientId, doctor?.id);

  // Получаем профиль пациента
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient-profile', patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId!)
        .single();
      return data;
    },
    enabled: !!patientId,
  });

  // Получаем записи пациента к этому врачу
  const { data: appointments } = useQuery({
    queryKey: ['patient-appointments', doctor?.id, patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*, services:appointment_services(*, service:services(*))')
        .eq('doctor_id', doctor!.id)
        .eq('patient_id', patientId!)
        .order('appointment_date', { ascending: false });
      return data || [];
    },
    enabled: !!doctor?.id && !!patientId,
  });

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  if (patientLoading || accessLoading) {
    return (
      <DoctorLayout>
        <div className="p-6 md:p-8 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Card>
            <CardContent className="p-card-x">
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DoctorLayout>
    );
  }

  if (!patient) {
    return (
      <DoctorLayout>
        <div className="p-6 md:p-8">
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">{t("doctorPatientProfile.patientNotFound")}</h3>
              <Button variant="outline" onClick={() => navigate('/doctor/patients')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("doctor.backToList")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DoctorLayout>
    );
  }

  const hasAccess = accessData?.hasAccess;
  const accessStatus = accessData?.status ?? 'none';
  const isPendingAccess = accessStatus === 'pending';
  const isRevokedAccess = accessStatus === 'revoked';
  const isExpiredAccess = accessStatus === 'expired';
  const requestedAt = accessData?.requestedAt ?? null;
  // Canonical column on the profiles view is date_of_birth (not birth_date).
  const age = getAge(patient.date_of_birth);

  return (
    <DoctorLayout>
      <div className="p-6 md:p-8 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/patients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("doctor.backToPatients")}
        </Button>

        {/* Patient Header */}
        <Card>
          <CardContent className="p-card-x">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={patient.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                  {getInitials(patient.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{patient.full_name || t("doctorPatientProfile.noName")}</h1>
                  {hasAccess ? (
                    <Badge variant="outline" className="gap-1.5 text-status-success border-status-success/30 bg-status-success-bg">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t("doctorPatientProfile.accessOpen")}
                      {accessData?.expiresAt && (
                        <span className="opacity-70">
                          · {t("doctorPatientProfile.until")} {format(accessData.expiresAt, "d MMM, HH:mm", { locale: ru })}
                        </span>
                      )}
                    </Badge>
                  ) : isPendingAccess ? (
                    <Badge variant="outline" className="gap-1.5 text-status-warning border-status-warning/40 bg-status-warning-bg">
                      <Clock className="h-3.5 w-3.5" />
                      {t("doctorPatientProfile.requestSent")}
                      {requestedAt && (
                        <span className="opacity-70">
                          · {format(requestedAt, "d MMM, HH:mm", { locale: ru })}
                        </span>
                      )}
                    </Badge>
                  ) : isRevokedAccess ? (
                    <Badge variant="outline" className="gap-1.5 text-status-danger border-status-danger/40 bg-status-danger-bg">
                      <XCircle className="h-3.5 w-3.5" />
                      {t("doctorPatientProfile.accessRevoked")}
                    </Badge>
                  ) : isExpiredAccess ? (
                    <Badge variant="outline" className="gap-1.5 text-muted-foreground border-border bg-muted/50">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t("doctorPatientProfile.accessExpired")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                      <ShieldX className="h-3.5 w-3.5" />
                      {t("doctorPatientProfile.noAccess")}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {patient.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      {patient.phone}
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      {patient.email}
                    </div>
                  )}
                  {age && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {age} {t("doctorPatientProfile.yearsSuffix")}
                    </div>
                  )}
                  {patient.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {patient.address}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 text-sm">
                  <span className="text-muted-foreground">{t("doctorPatientProfile.visitsToYou")}</span>
                  <Badge variant="secondary">{appointments?.length || 0}</Badge>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!hasAccess && doctor?.id && patientId && (
                  isPendingAccess ? (
                    <Button disabled variant="outline" className="gap-1.5">
                      <Clock className="h-4 w-4" />
                      {t("doctorPatientProfile.awaitingApproval")}
                    </Button>
                  ) : (
                    <Button onClick={() => setShowAccessDialog(true)} className="gap-1.5">
                      <Shield className="h-4 w-4" />
                      {isRevokedAccess || isExpiredAccess ? t("doctorPatientProfile.requestAgain") : t("doctorPatientProfile.requestAccess")}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/doctor/messages?patient=${patientId}`)}
                  className="gap-1.5"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("doctorPatientProfile.writeMsg")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Dialog */}
        {doctor?.id && patientId && (
          <RequestAccessDialog
            open={showAccessDialog}
            onOpenChange={setShowAccessDialog}
            patientId={patientId}
            patientName={patient.full_name || undefined}
            doctorId={doctor.id}
            source="search"
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-1.5">
              <Activity className="h-4 w-4" />
              {t("doctorPatientProfile.tabOverview")}
            </TabsTrigger>
            <TabsTrigger value="dental" className="gap-1.5">
              <FileHeart className="h-4 w-4" />
              {t("doctorPatientProfile.tabDental")}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5" disabled={!hasAccess}>
              <History className="h-4 w-4" />
              {t("doctorPatientProfile.tabHistory")}
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1.5" disabled={!hasAccess}>
              <FolderOpen className="h-4 w-4" />
              {t("doctorPatientProfile.tabFiles")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Appointments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {t("doctorPatientProfile.lastVisits")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {appointments && appointments.length > 0 ? (
                    <div className="space-y-3">
                      {appointments.slice(0, 5).map(apt => {
                        // Status is stored uppercase (CHECK constraint); compare
                        // case-insensitively.
                        const aptStatus = (apt.status || '').toLowerCase();
                        return (
                        <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{apt.service}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(apt.appointment_date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </p>
                          </div>
                          <Badge
                            variant={aptStatus === 'completed' ? 'default' : 'secondary'}
                          >
                            {aptStatus === 'completed' ? t("doctorPatientProfile.statusCompleted") :
                             aptStatus === 'confirmed' ? t("doctorPatientProfile.statusConfirmed") :
                             aptStatus === 'cancelled' ? t("doctorPatientProfile.statusCancelled") : t("doctorPatientProfile.statusPending")}
                          </Badge>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {t("doctorPatientProfile.noAppointments")}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Access Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {t("doctorPatientProfile.accessTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasAccess ? (
                    <div className="p-4 rounded-lg bg-status-success-bg border border-status-success/30">
                      <div className="flex items-center gap-2 text-status-success mb-2">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-medium">{t("doctorPatientProfile.accessOpenLabel")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("doctorPatientProfile.accessOpenDesc")}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <ShieldX className="h-5 w-5" />
                        <span className="font-medium">{t("doctorPatientProfile.noAccessLabel")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("doctorPatientProfile.noAccessDesc")}
                      </p>
                      {doctor?.id && patientId && (
                        <Button onClick={() => setShowAccessDialog(true)} className="gap-1.5">
                          <Shield className="h-4 w-4" />
                          {t("doctorPatientProfile.requestAccess")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dental">
            <Card>
              <CardContent className="p-card-x">
                <UltraRealisticDentalChart
                  patientId={patientId!}
                  birthDate={patient.date_of_birth}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            {hasAccess ? (
              <Card>
                <CardContent className="p-card-x">
                  <TreatmentHistory patientId={patientId!} />
                </CardContent>
              </Card>
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={isPendingAccess}
                pendingRequestDate={requestedAt?.toISOString()}
              />
            )}
          </TabsContent>

          <TabsContent value="files">
            {hasAccess ? (
              <Card>
                <CardContent className="p-card-x">
                  <PatientFiles patientId={patientId!} />
                </CardContent>
              </Card>
            ) : (
              <LockedMedicalRecord
                onRequestAccess={() => setShowAccessDialog(true)}
                isPending={isPendingAccess}
                pendingRequestDate={requestedAt?.toISOString()}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
}
