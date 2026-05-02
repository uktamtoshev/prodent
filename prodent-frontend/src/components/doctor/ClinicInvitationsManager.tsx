import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useState } from 'react';
import { 
  Building2, 
  Check, 
  X, 
  MapPin, 
  Phone,
  Loader2,
  Bell,
  Calendar,
  LogOut,
  AlertTriangle,
  UserMinus
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

interface ClinicInvitationsManagerProps {
  doctorId: string;
}

export function ClinicInvitationsManager({ doctorId }: ClinicInvitationsManagerProps) {
  const queryClient = useQueryClient();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<any>(null);

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
          clinic:clinics(
            id,
            name,
            address,
            city,
            phone,
            images,
            verified
          ),
          inviter:profiles!doctor_clinic_requests_invited_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('request_type', 'clinic_to_doctor')
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
            verified
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('request_type', 'clinic_remove_doctor')
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
            verified
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
      const invitation = invitations?.find(i => i.id === invitationId);
      if (!invitation) throw new Error('Приглашение не найдено');

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      if (accept) {
        // Add doctor to clinic_members
        const { error: memberError } = await supabase
          .from('clinic_members')
          .insert({
            clinic_id: invitation.clinic_id,
            user_id: user.id,
            role: 'doctor',
          });

        if (memberError && !memberError.message.includes('duplicate')) {
          throw memberError;
        }

        // Update doctor's clinic_id if they don't have one
        const { data: doctor } = await supabase
          .from('doctors')
          .select('clinic_id')
          .eq('id', doctorId)
          .single();

        if (!doctor?.clinic_id) {
          await supabase
            .from('doctors')
            .update({ clinic_id: invitation.clinic_id })
            .eq('id', doctorId);
        }
      }

      // Update request status
      const { error } = await supabase
        .from('doctor_clinic_requests')
        .update({
          status: accept ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: (_, { accept }) => {
      toast.success(accept ? 'Вы приняли приглашение!' : 'Приглашение отклонено');
      queryClient.invalidateQueries({ queryKey: ['clinic-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
    },
    onError: (error: any) => {
      toast.error('Ошибка', { description: error.message });
    },
  });

  // Respond to removal request from clinic
  const respondRemovalMutation = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      const request = removalRequests?.find(r => r.id === requestId);
      if (!request) throw new Error('Запрос не найден');

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      let departureResult = null;

      if (accept) {
        // Import and use doctor departure logic
        const { handleDoctorDeparture, deactivateDoctorAffiliation } = await import('@/lib/doctor-departure');
        
        // Handle patient ownership based on cooperation type
        departureResult = await handleDoctorDeparture(doctorId, request.clinic_id);
        console.log('Departure result:', departureResult);

        // Deactivate affiliation
        await deactivateDoctorAffiliation(doctorId, request.clinic_id);

        // Remove from clinic_members
        await supabase
          .from('clinic_members')
          .delete()
          .eq('user_id', user.id)
          .eq('clinic_id', request.clinic_id)
          .eq('role', 'doctor');

        // Clear clinic_id if matches
        const { data: doctor } = await supabase
          .from('doctors')
          .select('clinic_id')
          .eq('id', doctorId)
          .single();

        if (doctor?.clinic_id === request.clinic_id) {
          await supabase.from('doctors').update({ clinic_id: null }).eq('id', doctorId);
        }
      }

      await supabase
        .from('doctor_clinic_requests')
        .update({ status: accept ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('id', requestId);

      return { accept, departureResult };
    },
    onSuccess: ({ accept, departureResult }) => {
      if (accept && departureResult) {
        toast.success(`Вы покинули клинику. ${departureResult.message}`);
      } else if (accept) {
        toast.success('Вы покинули клинику');
      } else {
        toast.success('Запрос отклонён');
      }
      queryClient.invalidateQueries({ queryKey: ['doctor-removal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
    },
    onError: (error: any) => {
      toast.error('Ошибка', { description: error.message });
    },
  });

  // Leave clinic instantly without approval
  const leaveClinicMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClinic) throw new Error('Выберите клинику');

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      // Import and use doctor departure logic
      const { handleDoctorDeparture, deactivateDoctorAffiliation } = await import('@/lib/doctor-departure');
      
      // Handle patient ownership based on cooperation type
      const departureResult = await handleDoctorDeparture(doctorId, selectedClinic.clinic_id);
      console.log('Departure result:', departureResult);

      // Deactivate affiliation
      await deactivateDoctorAffiliation(doctorId, selectedClinic.clinic_id);

      // Remove from clinic_members
      await supabase
        .from('clinic_members')
        .delete()
        .eq('user_id', user.id)
        .eq('clinic_id', selectedClinic.clinic_id)
        .eq('role', 'doctor');

      // Clear clinic_id if matches
      const { data: doctor } = await supabase
        .from('doctors')
        .select('clinic_id')
        .eq('id', doctorId)
        .single();

      if (doctor?.clinic_id === selectedClinic.clinic_id) {
        await supabase.from('doctors').update({ clinic_id: null }).eq('id', doctorId);
      }

      return departureResult;
    },
    onSuccess: (result) => {
      const message = result?.message 
        ? `Вы покинули клинику. ${result.message}`
        : 'Вы покинули клинику';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['doctor-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      setLeaveDialogOpen(false);
      setSelectedClinic(null);
    },
    onError: (error: any) => {
      toast.error('Ошибка', { description: error.message });
    },
  });

  const pendingInvitations = invitations?.filter(i => i.status === 'pending') || [];
  const pendingRemovals = removalRequests?.filter(r => r.status === 'pending') || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Removal Requests from Clinics */}
      {pendingRemovals.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Запросы на удаление
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRemovals.map((request) => {
              const clinic = request.clinic as any;
              return (
                <div key={request.id} className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 rounded-lg">
                      <AvatarImage src={clinic?.images?.[0]} />
                      <AvatarFallback className="rounded-lg"><Building2 className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold">{clinic?.name}</h4>
                      <p className="text-sm text-muted-foreground">{clinic?.city}, {clinic?.address}</p>
                      {request.message && <p className="text-sm mt-2 p-2 bg-muted/50 rounded">{request.message}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="destructive" className="flex-1" onClick={() => respondRemovalMutation.mutate({ requestId: request.id, accept: true })} disabled={respondRemovalMutation.isPending}>
                      <Check className="mr-2 h-4 w-4" />Подтвердить уход
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => respondRemovalMutation.mutate({ requestId: request.id, accept: false })} disabled={respondRemovalMutation.isPending}>
                      <X className="mr-2 h-4 w-4" />Остаться
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5 text-primary" />Приглашения в клиники<Badge variant="secondary" className="ml-2">{pendingInvitations.length}</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInvitations.map((invitation) => {
              const clinic = invitation.clinic as any;
              return (
                <div key={invitation.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 rounded-lg"><AvatarImage src={clinic?.images?.[0]} /><AvatarFallback className="rounded-lg bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{clinic?.name}</h4>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /><span>{clinic?.city}, {clinic?.address}</span></div>
                      {invitation.message && <p className="text-sm mt-2 p-2 bg-muted/50 rounded">{invitation.message}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button className="flex-1" onClick={() => respondMutation.mutate({ invitationId: invitation.id, accept: true })} disabled={respondMutation.isPending}><Check className="mr-2 h-4 w-4" />Принять</Button>
                    <Button variant="outline" className="flex-1" onClick={() => respondMutation.mutate({ invitationId: invitation.id, accept: false })} disabled={respondMutation.isPending}><X className="mr-2 h-4 w-4" />Отклонить</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* My Clinics - with leave option */}
      {myClinics && myClinics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Мои клиники</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {myClinics.map((item) => {
              const clinic = item.clinic as any;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Avatar className="h-10 w-10 rounded-lg"><AvatarImage src={clinic?.images?.[0]} /><AvatarFallback className="rounded-lg"><Building2 className="h-4 w-4" /></AvatarFallback></Avatar>
                  <div className="flex-1"><p className="font-medium">{clinic?.name}</p><p className="text-sm text-muted-foreground">{clinic?.city}</p></div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClinic(item); setLeaveDialogOpen(true); }}><LogOut className="h-4 w-4 mr-1" />Покинуть</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {pendingInvitations.length === 0 && pendingRemovals.length === 0 && (!myClinics || myClinics.length === 0) && (
        <Card><CardContent className="py-8 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" /><p className="text-muted-foreground">Нет приглашений или клиник</p></CardContent></Card>
      )}

      {/* Leave Clinic Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Покинуть клинику</DialogTitle>
            <DialogDescription>Вы действительно хотите покинуть клинику "{(selectedClinic?.clinic as any)?.name}"? Это действие будет выполнено немедленно.</DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              <p>После выхода из клиники вы потеряете доступ к CRM клиники и расписанию.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={() => leaveClinicMutation.mutate()} disabled={leaveClinicMutation.isPending}>
              {leaveClinicMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Покинуть клинику
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
