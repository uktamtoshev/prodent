import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
      if (!request) throw new Error('Запрос не найден');

      // Update request status
      const { error: updateError } = await supabase
        .from('doctor_clinic_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      
      if (updateError) throw updateError;

      // Add doctor to clinic_members
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('user_id')
        .eq('id', request.doctor_id)
        .single();
      
      if (doctorError) throw doctorError;

      const { error: memberError } = await supabase
        .from('clinic_members')
        .insert({
          user_id: doctorData.user_id,
          clinic_id: currentClinic!.id,
          role: 'doctor',
        });
      
      // Ignore duplicate error
      if (memberError && memberError.code !== '23505') throw memberError;

      // Update doctor's clinic_id
      const { error: updateDoctorError } = await supabase
        .from('doctors')
        .update({ clinic_id: currentClinic!.id })
        .eq('id', request.doctor_id);
      
      if (updateDoctorError) throw updateDoctorError;
    },
    onSuccess: () => {
      toast.success('Врач добавлен в клинику');
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при одобрении запроса');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase
        .from('doctor_clinic_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Запрос отклонён');
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-requests'] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
    },
    onError: () => {
      toast.error('Ошибка при отклонении запроса');
    },
  });

  // Approve leave request from doctor
  const approveLeaveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = leaveRequests?.find(r => r.id === requestId);
      if (!request) throw new Error('Запрос не найден');

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      // Import and use doctor departure logic
      const { handleDoctorDeparture, deactivateDoctorAffiliation } = await import('@/lib/doctor-departure');
      
      // Handle patient ownership based on cooperation type
      const departureResult = await handleDoctorDeparture(request.doctor_id, currentClinic!.id);
      console.log('Departure result:', departureResult);

      // Update request status
      const { error: updateError } = await supabase
        .from('doctor_clinic_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', requestId);
      
      if (updateError) throw updateError;

      // Get doctor's user_id
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('user_id, clinic_id')
        .eq('id', request.doctor_id)
        .single();
      
      if (doctorError) throw doctorError;

      // Deactivate affiliation instead of hard delete
      await deactivateDoctorAffiliation(request.doctor_id, currentClinic!.id);

      // Remove doctor from clinic_members
      const { error: memberError } = await supabase
        .from('clinic_members')
        .delete()
        .eq('user_id', doctorData.user_id)
        .eq('clinic_id', currentClinic!.id)
        .eq('role', 'doctor');
      
      if (memberError) throw memberError;

      // Clear doctor's clinic_id if it matches this clinic
      if (doctorData.clinic_id === currentClinic!.id) {
        await supabase
          .from('doctors')
          .update({ clinic_id: null })
          .eq('id', request.doctor_id);
      }

      return departureResult;
    },
    onSuccess: (result) => {
      const message = result?.message 
        ? `Врач удален из клиники. ${result.message}`
        : 'Врач удален из клиники';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['clinic-doctor-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при одобрении запроса');
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
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning-amber border-warning-amber"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
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
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 cursor-help gap-1 text-xs">
                <Building2 className="w-3 h-3" />
                Штатный
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">Штатный врач</p>
                <p className="text-xs text-muted-foreground">
                  Работает на клинику. Получает процент от услуг. 
                  Пациенты учитываются в кассе клиники.
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
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 cursor-help gap-1 text-xs">
                <Armchair className="w-3 h-3" />
                Арендатор
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">Арендатор кресла</p>
                <p className="text-xs text-muted-foreground">
                  Арендует рабочее место. Ведёт своих пациентов. 
                  Доходы вне кассы клиники.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return null;
  };

  const pendingIncoming = incomingRequests?.filter(r => r.status === 'pending') || [];
  const processedIncoming = incomingRequests?.filter(r => r.status !== 'pending') || [];
  const pendingOutgoing = outgoingInvitations?.filter(r => r.status === 'pending') || [];
  const processedOutgoing = outgoingInvitations?.filter(r => r.status !== 'pending') || [];
  const pendingLeave = leaveRequests?.filter(r => r.status === 'pending') || [];
  const processedLeave = leaveRequests?.filter(r => r.status !== 'pending') || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Управление врачами
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRemoveDialogOpen(true)}>
              <UserMinus className="mr-2 h-4 w-4" />
              Удалить врача
            </Button>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Пригласить врача
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incoming" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="incoming" className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                <span className="hidden sm:inline">Входящие</span>
                {pendingIncoming.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingIncoming.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Приглашения</span>
                {pendingOutgoing.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingOutgoing.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="leave" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Уход</span>
                {pendingLeave.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingLeave.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Incoming Requests Tab */}
            <TabsContent value="incoming" className="space-y-6">
              {pendingIncoming.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Новые запросы</h4>
                  {pendingIncoming.map((request) => (
                    <div key={request.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">{request.doctor?.profile?.full_name || 'Врач'}</h4>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {request.doctor?.specialty}
                            </span>
                            <span>•</span>
                            <span>Опыт: {request.doctor?.experience_years} лет</span>
                            {request.doctor?.cooperation_type && (
                              <>
                                <span>•</span>
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
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{request.message}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
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
                          Принять
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedIncoming.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">История запросов</h4>
                  {processedIncoming.map((request) => (
                    <div key={request.id} className="p-4 border rounded-lg flex items-center justify-between bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.doctor?.profile?.full_name || 'Врач'}</p>
                          <p className="text-sm text-muted-foreground">{request.doctor?.specialty}</p>
                          {request.rejection_reason && (
                            <p className="text-xs text-destructive mt-1">Причина: {request.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}

              {incomingRequests?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Нет входящих запросов от врачей</p>
                </div>
              )}
            </TabsContent>

            {/* Outgoing Invitations Tab */}
            <TabsContent value="outgoing" className="space-y-6">
              {pendingOutgoing.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Ожидают ответа</h4>
                  {pendingOutgoing.map((invitation) => (
                    <div key={invitation.id} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={invitation.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{invitation.doctor?.profile?.full_name || 'Врач'}</p>
                          <p className="text-sm text-muted-foreground">{invitation.doctor?.specialty}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(invitation.created_at), 'd MMMM yyyy', { locale: ru })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-warning-amber border-warning-amber">
                        <Clock className="w-3 h-3 mr-1" />
                        Ожидает
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {processedOutgoing.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">История приглашений</h4>
                  {processedOutgoing.map((invitation) => (
                    <div key={invitation.id} className="p-4 border rounded-lg flex items-center justify-between bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={invitation.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{invitation.doctor?.profile?.full_name || 'Врач'}</p>
                          <p className="text-sm text-muted-foreground">{invitation.doctor?.specialty}</p>
                        </div>
                      </div>
                      {getStatusBadge(invitation.status)}
                    </div>
                  ))}
                </div>
              )}

              {outgoingInvitations?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Вы ещё не отправляли приглашения врачам</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Пригласить врача
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Leave Requests Tab */}
            <TabsContent value="leave" className="space-y-6">
              {pendingLeave.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-warning-amber/10 border border-warning-amber/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-warning-amber" />
                    <p className="text-sm">Эти врачи хотят покинуть клинику. Подтвердите их уход.</p>
                  </div>
                  {pendingLeave.map((request) => (
                    <div key={request.id} className="p-4 border rounded-lg space-y-3 border-warning-amber/30">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">{request.doctor?.profile?.full_name || 'Врач'}</h4>
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
                        <Badge variant="outline" className="text-warning-amber border-warning-amber">
                          <LogOut className="w-3 h-3 mr-1" />
                          Хочет уйти
                        </Badge>
                      </div>

                      {request.message && (
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{request.message}</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
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
                          Подтвердить уход
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={rejectMutation.isPending}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedLeave.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">История</h4>
                  {processedLeave.map((request) => (
                    <div key={request.id} className="p-4 border rounded-lg flex items-center justify-between bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.doctor?.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.doctor?.profile?.full_name || 'Врач'}</p>
                          <p className="text-sm text-muted-foreground">{request.doctor?.specialty}</p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}

              {leaveRequests?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <LogOut className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Нет запросов на уход от врачей</p>
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
            <DialogTitle>Отклонить запрос</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения запроса от {selectedRequest?.doctor?.profile?.full_name}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Причина отклонения (необязательно)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
