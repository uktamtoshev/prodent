import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useState } from 'react';
import { 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  MessageSquare,
  User,
  Stethoscope,
  Calendar,
  Send,
  Inbox,
  UserMinus,
  LogOut,
  AlertTriangle,
  Building2,
  Armchair,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { InviteDoctorDialog } from './InviteDoctorDialog';
import { RemoveDoctorDialog } from './RemoveDoctorDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  decideDoctorClinicRequest,
  normalizeDoctorClinicRequestStatus,
} from '@/lib/doctor-clinic-requests-api';

interface DoctorRequest {
  id: string;
  doctor_id: string;
  clinic_id: string;
  status: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  doctor: {
    id: string;
    specialty: string;
    experience_years: number;
    cooperation_type: string | null;
    profile: {
      full_name: string;
      avatar_url: string | null;
      phone: string | null;
    } | null;
  };
}

export function DoctorRequestsManager() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DoctorRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  // Incoming requests from doctors
  const { data: incomingRequests, isLoading: loadingIncoming } = useQuery({
    queryKey: ['clinic-doctor-requests', currentClinic?.id, 'incoming'],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          *,
          doctor:doctors(
            id,
            specialty,
            experience_years,
            cooperation_type,
            profile:profiles!doctors_user_id_fkey(full_name, avatar_url, phone)
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('request_type', 'doctor_to_clinic')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DoctorRequest[];
    },
    enabled: !!currentClinic?.id,
  });

  // Outgoing invitations to doctors
  const { data: outgoingInvitations, isLoading: loadingOutgoing } = useQuery({
    queryKey: ['clinic-doctor-invitations', currentClinic?.id, 'outgoing'],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          *,
          doctor:doctors(
            id,
            specialty,
            experience_years,
            cooperation_type,
            profile:profiles!doctors_user_id_fkey(full_name, avatar_url, phone)
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('request_type', 'clinic_to_doctor')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DoctorRequest[];
    },
    enabled: !!currentClinic?.id,
  });

  // Doctor leave requests (doctors wanting to leave this clinic)
  const { data: leaveRequests, isLoading: loadingLeave } = useQuery({
    queryKey: ['clinic-doctor-leave-requests', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('doctor_clinic_requests')
        .select(`
          *,
          doctor:doctors(
            id,
            specialty,
            experience_years,
            cooperation_type,
            profile:profiles!doctors_user_id_fkey(full_name, avatar_url, phone)
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('request_type', 'doctor_leave_clinic')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DoctorRequest[];
    },
    enabled: !!currentClinic?.id,
  });

  const isLoading = loadingIncoming || loadingOutgoing || loadingLeave;

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = incomingRequests?.find(r => r.id === requestId);
      if (!request) throw new Error(t('crmDoctorRequestsMgr.requestNotFound'));

      await decideDoctorClinicRequest(requestId, 'accept');
    },
    onSuccess: () => {
      toast.success(t('crmDoctorRequestsMgr.doctorAdded'));
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['service-doctor-assignments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('crmDoctorRequestsMgr.approveError'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      await decideDoctorClinicRequest(requestId, 'reject', reason);
    },
    onSuccess: () => {
      toast.success(t('crmDoctorRequestsMgr.requestRejected'));
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-leave-requests'] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
    },
    onError: () => {
      toast.error(t('crmDoctorRequestsMgr.rejectError'));
    },
  });

  // Approve leave request from doctor
  const approveLeaveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = leaveRequests?.find(r => r.id === requestId);
      if (!request) throw new Error(t('crmDoctorRequestsMgr.requestNotFound'));

      await decideDoctorClinicRequest(requestId, 'accept');
    },
    onSuccess: () => {
      toast.success(t('crmDoctorRequestsMgr.doctorRemoved'));
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      queryClient.invalidateQueries({ queryKey: ['service-doctor-assignments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('crmDoctorRequestsMgr.approveError'));
    },
  });

  const handleReject = (request: DoctorRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({
        requestId: selectedRequest.id,
        reason: rejectionReason,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (normalizeDoctorClinicRequestStatus(status)) {
      case 'pending':
        return <Badge variant="outline" className="text-status-warning border-status-warning"><Clock className="w-3 h-3 mr-1" />{t('crmDoctorRequestsMgr.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-status-success border-status-success"><CheckCircle className="w-3 h-3 mr-1" />{t('crmDoctorRequestsMgr.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="w-3 h-3 mr-1" />{t('crmDoctorRequestsMgr.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const getCooperationTypeBadge = (type: string | null) => {
    if (type === 'staff_doctor') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-status-info/10 text-status-info border-status-info/30 hover:bg-status-info/20 cursor-help gap-1 text-xs">
                <Building2 className="w-3 h-3" />
                {t('crmDoctorRequestsMgr.staff')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{t('crmDoctorRequestsMgr.staffDoctor')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('crmDoctorRequestsMgr.staffDoctorDesc')}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (type === 'chair_rental') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-status-neutral/10 text-status-neutral border-status-neutral/30 hover:bg-status-neutral/20 cursor-help gap-1 text-xs">
                <Armchair className="w-3 h-3" />
                {t('crmDoctorRequestsMgr.tenant')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{t('crmDoctorRequestsMgr.chairTenant')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('crmDoctorRequestsMgr.chairTenantDesc')}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return null;
  };

  const pendingIncoming = incomingRequests?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) === 'pending',
  ) || [];
  const processedIncoming = incomingRequests?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) !== 'pending',
  ) || [];
  const pendingOutgoing = outgoingInvitations?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) === 'pending',
  ) || [];
  const processedOutgoing = outgoingInvitations?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) !== 'pending',
  ) || [];
  const pendingLeave = leaveRequests?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) === 'pending',
  ) || [];
  const processedLeave = leaveRequests?.filter(
    (request) => normalizeDoctorClinicRequestStatus(request.status) !== 'pending',
  ) || [];

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
          <Skeleton className="h-8 w-56" />
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/50 bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <UserPlus className="h-5 w-5" />
            {t('crmDoctorRequestsMgr.doctorsManagement')}
          </CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={() => setRemoveDialogOpen(true)} className="w-full sm:w-auto">
              <UserMinus className="mr-2 h-4 w-4" />
              {t('crmDoctorRequestsMgr.removeDoctor')}
            </Button>
            <Button onClick={() => setInviteDialogOpen(true)} className="w-full sm:w-auto">
              <Send className="mr-2 h-4 w-4" />
              {t('crmDoctorRequestsMgr.inviteDoctor')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-card-x">
          {/* Показатели заявок. Считаются из уже загруженных списков: новых
              запросов не нужно. Двух эталонных показателей здесь нет —
              «Средний стаж кандидатов» и «Свободных кресел» требуют полей,
              которых в заявке не приходит. */}
          <div className="mb-section grid grid-cols-2 gap-section sm:max-w-md">
            <div className="rounded-panel border border-border bg-card px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">{t('crmDoctorRequestsMgr.newRequests')}</p>
              <p className="text-kpi tabular-nums font-heading">{pendingIncoming.length}</p>
            </div>
            <div className="rounded-panel border border-border bg-card px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">{t('crmDoctorRequestsMgr.requestHistory')}</p>
              <p className="text-kpi tabular-nums font-heading">{processedIncoming.length}</p>
            </div>
          </div>
          <Tabs defaultValue="incoming" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5">
              <TabsTrigger value="incoming" className="flex items-center gap-2 rounded-lg py-2">
                <Inbox className="h-4 w-4" />
                <span className="hidden sm:inline">{t('crmDoctorRequestsMgr.tabIncoming')}</span>
                {pendingIncoming.length > 0 && (
                  <Badge variant="secondary" className="ml-1 rounded-full">{pendingIncoming.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="flex items-center gap-2 rounded-lg py-2">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t('crmDoctorRequestsMgr.tabInvitations')}</span>
                {pendingOutgoing.length > 0 && (
                  <Badge variant="secondary" className="ml-1 rounded-full">{pendingOutgoing.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="leave" className="flex items-center gap-2 rounded-lg py-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t('crmDoctorRequestsMgr.tabLeave')}</span>
                {pendingLeave.length > 0 && (
                  <Badge variant="destructive" className="ml-1 rounded-full">{pendingLeave.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Incoming Requests Tab */}
            <TabsContent value="incoming" className="space-y-6">
              {pendingIncoming.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground">{t('crmDoctorRequestsMgr.newRequests')}</h4>
                  {pendingIncoming.map((request) => (
                    <div key={request.id} className="space-y-3 rounded-panel border border-border/50 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">{request.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</h4>
                          <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {request.doctor?.specialty}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{t('crmDoctorRequestsMgr.experience')} {request.doctor?.experience_years} {t('crmDoctorRequestsMgr.years')}</span>
                            {request.doctor?.cooperation_type && (
                              <>
                                <span aria-hidden="true">·</span>
                                {getCooperationTypeBadge(request.doctor.cooperation_type)}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(request.created_at), 'd MMMM yyyy', { locale: ru })}
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      {request.message && (
                        <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{request.message}</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                        <Button
                          onClick={() => approveMutation.mutate(request.id)}
                          disabled={approveMutation.isPending}
                          className="flex-1"
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          {t('crmDoctorRequestsMgr.accept')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t('crmDoctorRequestsMgr.reject')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedIncoming.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground">{t('crmDoctorRequestsMgr.requestHistory')}</h4>
                  {processedIncoming.map((request) => (
                    <div key={request.id} className="flex flex-col gap-3 rounded-panel border border-border/50 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</p>
                          <p className="text-sm text-muted-foreground">{request.doctor?.specialty}</p>
                          {request.rejection_reason && (
                            <p className="text-xs text-destructive mt-1">{t('crmDoctorRequestsMgr.reason')} {request.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}

              {incomingRequests?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('crmDoctorRequestsMgr.noIncoming')}</p>
                </div>
              )}
            </TabsContent>

            {/* Outgoing Invitations Tab */}
            <TabsContent value="outgoing" className="space-y-6">
              {pendingOutgoing.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground">{t('crmDoctorRequestsMgr.waitingResponse')}</h4>
                  {pendingOutgoing.map((invitation) => (
                    <div key={invitation.id} className="flex flex-col gap-3 rounded-panel border border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={invitation.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{invitation.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</p>
                          <p className="text-sm text-muted-foreground">{invitation.doctor?.specialty}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(invitation.created_at), 'd MMMM yyyy', { locale: ru })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-status-warning border-status-warning">
                        <Clock className="w-3 h-3 mr-1" />
                        {t('crmDoctorRequestsMgr.pending')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {processedOutgoing.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground">{t('crmDoctorRequestsMgr.invitationsHistory')}</h4>
                  {processedOutgoing.map((invitation) => (
                    <div key={invitation.id} className="flex flex-col gap-3 rounded-panel border border-border/50 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={invitation.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{invitation.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</p>
                          <p className="text-sm text-muted-foreground">{invitation.doctor?.specialty}</p>
                        </div>
                      </div>
                      {getStatusBadge(invitation.status)}
                    </div>
                  ))}
                </div>
              )}

              {outgoingInvitations?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('crmDoctorRequestsMgr.noInvitationsSent')}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('crmDoctorRequestsMgr.inviteDoctor')}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Leave Requests Tab */}
            <TabsContent value="leave" className="space-y-6">
              {pendingLeave.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-status-warning/20 bg-status-warning/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-status-warning" />
                    <p className="text-sm">{t('crmDoctorRequestsMgr.doctorsWantLeave')}</p>
                  </div>
                  {pendingLeave.map((request) => (
                    <div key={request.id} className="space-y-3 rounded-2xl border border-status-warning/30 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">{request.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</h4>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {request.doctor?.specialty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(request.created_at), 'd MMMM yyyy', { locale: ru })}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-status-warning border-status-warning">
                          <LogOut className="w-3 h-3 mr-1" />
                          {t('crmDoctorRequestsMgr.wantsToLeave')}
                        </Badge>
                      </div>

                      {request.message && (
                        <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{request.message}</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                        <Button
                          variant="destructive"
                          onClick={() => approveLeaveRequestMutation.mutate(request.id)}
                          disabled={approveLeaveRequestMutation.isPending}
                          className="flex-1"
                        >
                          {approveLeaveRequestMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          {t('crmDoctorRequestsMgr.confirmLeave')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t('crmDoctorRequestsMgr.reject')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedLeave.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground">{t('crmDoctorRequestsMgr.history')}</h4>
                  {processedLeave.map((request) => (
                    <div key={request.id} className="flex flex-col gap-3 rounded-panel border border-border/50 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.doctor?.profile?.full_name || t('crmDoctorRequestsMgr.defaultDoctor')}</p>
                          <p className="text-sm text-muted-foreground">{request.doctor?.specialty}</p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}

              {leaveRequests?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center text-muted-foreground">
                  <LogOut className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('crmDoctorRequestsMgr.noLeaveRequests')}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invite Doctor Dialog */}
      {currentClinic && (
        <InviteDoctorDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          clinicId={currentClinic.id}
        />
      )}

      {/* Remove Doctor Dialog */}
      <RemoveDoctorDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crmDoctorRequestsMgr.rejectRequest')}</DialogTitle>
            <DialogDescription>
              {t('crmDoctorRequestsMgr.rejectReasonFor')} {selectedRequest?.doctor?.profile?.full_name}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('crmDoctorRequestsMgr.rejectReasonPlaceholder')}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t('crmDoctorRequestsMgr.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('crmDoctorRequestsMgr.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
