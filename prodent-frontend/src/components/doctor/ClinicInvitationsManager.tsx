import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Check,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  UserMinus,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { handleDoctorDeparture } from '@/lib/doctor-departure';
import {
  decideDoctorClinicRequest,
  normalizeDoctorClinicRequestStatus,
} from '@/lib/doctor-clinic-requests-api';

interface ClinicInvitationsManagerProps {
  doctorId: string;
}

interface ClinicInfo {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  images: string[] | null;
  is_verified: boolean | null;
}

interface SelectedClinicMembership {
  clinic_id: string;
  clinic: unknown;
}

interface InvitationTerms {
  cooperation_type?: string | null;
  salary_mode?: string | null;
  salary_percent?: number | null;
  salary_amount?: number | null;
  rental_fee?: number | null;
  rental_period?: string | null;
}

const clinicFromRelation = (value: unknown): ClinicInfo | null => {
  const clinic = Array.isArray(value) ? value[0] : value;
  if (!clinic || typeof clinic !== 'object') return null;
  return clinic as ClinicInfo;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const compactNumber = (value: number) => Number(value).toLocaleString('ru-RU');

export function ClinicInvitationsManager({ doctorId }: ClinicInvitationsManagerProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [inviteTab, setInviteTab] = useState<'pending' | 'clinics'>('pending');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<SelectedClinicMembership | null>(null);

  // Clinic invitations (clinic inviting doctor)
  const { data: invitations, isLoading: loadingInvitations } = useQuery({
    queryKey: ['clinic-invitations', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          id,
          clinic_id,
          message,
          status,
          created_at,
          cooperation_type,
          salary_mode,
          salary_percent,
          salary_amount,
          rental_fee,
          rental_period,
          clinic:clinics(
            id,
            name,
            address,
            city,
            phone,
            images,
            is_verified
          ),
          inviter:profiles!doctor_clinic_requests_invited_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('request_type', 'clinic_to_doctor')
        .ilike('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Removal requests from clinics (clinic wants to remove doctor)
  const { data: removalRequests, isLoading: loadingRemoval } = useQuery({
    queryKey: ['doctor-removal-requests', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          id,
          clinic_id,
          message,
          status,
          created_at,
          clinic:clinics(
            id,
            name,
            address,
            city,
            phone,
            images,
            is_verified
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('request_type', 'clinic_remove_doctor')
        .ilike('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Doctor's current clinics
  const { data: myClinics, isLoading: loadingClinics } = useQuery({
    queryKey: ['doctor-clinics', doctorId],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];

      const { data, error } = await supabase
        .from('clinic_members')
        .select(`
          id,
          clinic_id,
          clinic:clinics(
            id,
            name,
            address,
            city,
            phone,
            images,
            is_verified
          )
        `)
        .eq('user_id', user.id)
        .eq('role', 'doctor');

      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingInvitations || loadingRemoval || loadingClinics;

  const respondMutation = useMutation({
    mutationFn: async ({ invitationId, accept }: { invitationId: string; accept: boolean }) => {
      const invitation = invitations?.find((item) => item.id === invitationId);
      if (!invitation) throw new Error(t('crmInvitations.noInvites'));

      await decideDoctorClinicRequest(invitationId, accept ? 'accept' : 'reject');
    },
    onSuccess: (_, { accept }) => {
      toast.success(accept ? t('crmInvitations.acceptedToast') : t('crmInvitations.declinedToast'));
      queryClient.invalidateQueries({ queryKey: ['clinic-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['service-doctor-assignments'] });
    },
    onError: (error: unknown) => {
      toast.error(t('crmInvitations.acceptError'), { description: errorMessage(error) });
    },
  });

  // Respond to removal request from clinic
  const respondRemovalMutation = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      const request = removalRequests?.find((item) => item.id === requestId);
      if (!request) throw new Error(t('crmInvitations.noInvites'));

      await decideDoctorClinicRequest(requestId, accept ? 'accept' : 'reject');
      return { accept };
    },
    onSuccess: ({ accept }) => {
      toast.success(accept ? t('crmInvitations.left') : t('crmInvitations.declinedToast'));
      queryClient.invalidateQueries({ queryKey: ['doctor-removal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['service-doctor-assignments'] });
    },
    onError: (error: unknown) => {
      toast.error(t('crmInvitations.acceptError'), { description: errorMessage(error) });
    },
  });

  // Leave clinic instantly without approval
  const leaveClinicMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClinic) throw new Error(t('crmInvitations.leaveError'));

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error(t('crmInvitations.leaveError'));

      return handleDoctorDeparture(doctorId, selectedClinic.clinic_id);
    },
    onSuccess: (result) => {
      const message = result?.message
        ? `${t('crmInvitations.left')}. ${result.message}`
        : t('crmInvitations.left');
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      setLeaveDialogOpen(false);
      setSelectedClinic(null);
    },
    onError: (error: unknown) => {
      toast.error(t('crmInvitations.leaveError'), { description: errorMessage(error) });
    },
  });

  const pendingInvitations =
    invitations?.filter(
      (invitation) => normalizeDoctorClinicRequestStatus(invitation.status) === 'pending',
    ) || [];
  const pendingRemovals =
    removalRequests?.filter(
      (request) => normalizeDoctorClinicRequestStatus(request.status) === 'pending',
    ) || [];

  const formatClinicAddress = (clinic: ClinicInfo | null) =>
    [clinic?.city, clinic?.address].filter(Boolean).join(', ') || t('crmInvitations.unknownAddress');

  const formatInvitationTerms = (invitation: InvitationTerms) => {
    if (!invitation.cooperation_type) return null;

    if (invitation.cooperation_type === 'staff_doctor') {
      let pay = '';
      if (invitation.salary_mode === 'fixed' && invitation.salary_amount != null) {
        pay = `${t('crmInvitations.fixedSalary')} - ${compactNumber(invitation.salary_amount)} ${t('crmInvitations.sumPerMonth')}`;
      } else if (invitation.salary_mode === 'agreement') {
        pay = t('crmInvitations.byAgreement');
      } else if (invitation.salary_mode === 'intern') {
        pay = t('crmInvitations.intern');
      } else if (invitation.salary_percent != null) {
        pay = `${t('crmInvitations.clinicShare')} ${invitation.salary_percent}%`;
      }

      return `${t('crmInvitations.staffDoctor')}${pay ? ` - ${pay}` : ''}`;
    }

    let terms: string;
    if (invitation.rental_period === 'negotiable') {
      terms = t('crmInvitations.byAgreement');
    } else if (invitation.rental_fee != null && Number(invitation.rental_fee) === 0) {
      terms = t('crmInvitations.free');
    } else if (invitation.rental_fee != null) {
      terms = `${compactNumber(invitation.rental_fee)} ${
        invitation.rental_period === 'daily'
          ? t('crmInvitations.sumPerDay')
          : t('crmInvitations.sumPerMonth')
      }`;
    } else {
      terms = t('crmInvitations.negotiated');
    }

    return `${t('crmInvitations.chairRental')} - ${terms}`;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 shadow-soft">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-section">
      {/* Срезы раздела. Из эталонных вкладок поддержаны те, под которые есть
          данные: новые приглашения и текущие места работы. «Я откликнулся» и
          «Отклонённые» требуют истории решений врача, которой в ответе нет. */}
      <div className="flex flex-wrap items-center gap-0.5">
        {([
          { key: 'pending' as const, label: t('crmInvitations.pendingTitle'), n: pendingInvitations.length },
          { key: 'clinics' as const, label: t('crmInvitations.currentClinics'), n: myClinics?.length ?? 0 },
        ]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setInviteTab(item.key)}
            aria-pressed={inviteTab === item.key}
            className={cn(
              'cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              inviteTab === item.key
                ? 'border border-b-0 border-border bg-card font-semibold text-primary shadow-soft'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.n > 0 && (
              <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                {item.n}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Запросы на удаление — это тоже ожидающее решение врача, поэтому они
          живут на вкладке ожидания вместе с приглашениями. На «Текущих
          клиниках» их быть не должно: там список мест работы, а не входящие
          обращения. */}
      {inviteTab === 'pending' && pendingRemovals.length > 0 && (
        <Card className="overflow-hidden border-destructive/50 bg-destructive/5 shadow-soft">
          <CardHeader className="border-b border-destructive/20 bg-destructive/5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <UserMinus className="h-5 w-5" />
              {t('crmInvitations.removalTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-section p-card-x">
            {pendingRemovals.map((request) => {
              const clinic = clinicFromRelation(request.clinic);
              return (
                <div key={request.id} className="rounded-panel border border-destructive/30 bg-card p-card-x">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <Avatar className="h-10 w-10 rounded-field">
                      <AvatarImage src={clinic?.images?.[0]} />
                      <AvatarFallback className="rounded-field bg-destructive/10 text-destructive">
                        <Building2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h4 className="font-semibold">{clinic?.name || t('crmInvitations.unknownClinic')}</h4>
                      <p className="text-sm text-muted-foreground">{formatClinicAddress(clinic)}</p>
                      {request.message && (
                        <p className="rounded-xl bg-muted/50 p-3 text-sm">{request.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => respondRemovalMutation.mutate({ requestId: request.id, accept: true })}
                      disabled={respondRemovalMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {t('crmInvitations.accept')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => respondRemovalMutation.mutate({ requestId: request.id, accept: false })}
                      disabled={respondRemovalMutation.isPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('crmInvitations.decline')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {inviteTab === 'pending' && pendingInvitations.length > 0 && (
        <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft">
          <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Bell className="h-5 w-5 text-primary" />
              {t('crmInvitations.pendingTitle')}
              <Badge variant="secondary" className="ml-1 rounded-full">
                {pendingInvitations.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-section p-card-x">
            {pendingInvitations.map((invitation) => {
              const clinic = clinicFromRelation(invitation.clinic);
              const terms = formatInvitationTerms(invitation as InvitationTerms);
              return (
                <div key={invitation.id} className="rounded-panel border border-border/50 bg-card p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <Avatar className="h-14 w-14 rounded-xl">
                      <AvatarImage src={clinic?.images?.[0]} />
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                        <Building2 className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h4 className="font-semibold">{clinic?.name || t('crmInvitations.unknownClinic')}</h4>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{formatClinicAddress(clinic)}</span>
                      </div>
                      {clinic?.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{clinic.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{format(new Date(invitation.created_at), 'd MMMM yyyy', { locale: ru })}</span>
                      </div>
                      {invitation.message && (
                        <p className="rounded-xl bg-muted/50 p-3 text-sm">{invitation.message}</p>
                      )}
                      {terms && (
                        <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {t('crmInvitations.offerPrefix')}: {terms}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1"
                      onClick={() => respondMutation.mutate({ invitationId: invitation.id, accept: true })}
                      disabled={respondMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {t('crmInvitations.accept')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => respondMutation.mutate({ invitationId: invitation.id, accept: false })}
                      disabled={respondMutation.isPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('crmInvitations.decline')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {inviteTab === 'clinics' && myClinics && myClinics.length > 0 && (
        <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft">
          <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
            <CardTitle className="text-base font-bold">{t('crmInvitations.currentClinics')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {myClinics.map((item) => {
              const clinic = clinicFromRelation(item.clinic);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-panel border border-border/50 p-3 sm:flex-row sm:items-center"
                >
                  <Avatar className="h-10 w-10 rounded-xl">
                    <AvatarImage src={clinic?.images?.[0]} />
                    <AvatarFallback className="rounded-xl">
                      <Building2 className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{clinic?.name || t('crmInvitations.unknownClinic')}</p>
                    <p className="text-sm text-muted-foreground">{formatClinicAddress(clinic)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setSelectedClinic(item);
                      setLeaveDialogOpen(true);
                    }}
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    {t('crmInvitations.leaveClinic')}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Пустота считается по ВЫБРАННОЙ вкладке: раньше подсказка появлялась,
          только когда пусто везде, поэтому на пустой вкладке экран был просто
          белым, без объяснения. */}
      {/* Пустота считается ОТДЕЛЬНО для каждой вкладки. На вкладке ожидания
          пусто только когда нет ни приглашений, ни запросов на удаление; на
          «Текущих клиниках» — когда нет мест работы, и запросы на удаление на
          это не влияют, потому что их там не показывают. */}
      {((inviteTab === 'pending' && pendingInvitations.length === 0 && pendingRemovals.length === 0)
        || (inviteTab === 'clinics' && (!myClinics || myClinics.length === 0))) && (
        <Card className="border-dashed border-border bg-muted/20">
          <CardContent className="px-6 py-10 text-center">
            <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('crmInvitations.noInvites')}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crmInvitations.leaveClinic')}</DialogTitle>
            <DialogDescription>
              {t('crmInvitations.leaveConfirm')} "{clinicFromRelation(selectedClinic?.clinic)?.name || t('crmInvitations.unknownClinic')}"?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-status-warning/30 bg-status-warning-bg p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" />
              <p>{t('crmInvitations.leaveWarning')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
              {t('crmInvitations.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => leaveClinicMutation.mutate()}
              disabled={leaveClinicMutation.isPending}
            >
              {leaveClinicMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('crmInvitations.leaveClinic')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
