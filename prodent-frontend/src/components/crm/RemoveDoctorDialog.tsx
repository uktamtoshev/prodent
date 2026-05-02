import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  UserMinus, 
  Loader2,
  User,
  Stethoscope,
  Building2,
  Armchair,
  Users,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getDoctorDepartureInfo } from '@/lib/doctor-departure';

interface RemoveDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveDoctorDialog({ open, onOpenChange }: RemoveDoctorDialogProps) {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  // Get doctors in this clinic with affiliation info
  const { data: clinicDoctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ['clinic-doctors-for-removal', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      // Get clinic members who are doctors
      const { data: members, error: membersError } = await supabase
        .from('clinic_members')
        .select('id, user_id')
        .eq('clinic_id', currentClinic.id)
        .eq('role', 'doctor');

      if (membersError) throw membersError;
      if (!members?.length) return [];

      const userIds = members.map(m => m.user_id);

      // Get doctor records for these users
      const { data: doctors, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, user_id, specialty, experience_years, cooperation_type')
        .in('user_id', userIds);

      if (doctorsError) throw doctorsError;

      // Get affiliations for this clinic
      const doctorIds = doctors?.map(d => d.id) || [];
      const { data: affiliations } = await supabase
        .from('doctor_clinic_affiliations')
        .select('doctor_id, cooperation_type')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .in('doctor_id', doctorIds);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      return members.map(member => {
        const doctor = doctors?.find(d => d.user_id === member.user_id);
        const affiliation = affiliations?.find(a => a.doctor_id === doctor?.id);
        const cooperationType = affiliation?.cooperation_type || doctor?.cooperation_type || 'staff_doctor';
        
        return {
          ...member,
          doctor,
          profile: profiles?.find(p => p.id === member.user_id),
          cooperationType,
        };
      }).filter(m => m.doctor);
    },
    enabled: open && !!currentClinic?.id,
  });

  // Get departure info when doctor is selected
  const { data: departureInfo, isLoading: loadingDepartureInfo } = useQuery({
    queryKey: ['doctor-departure-info', currentClinic?.id, selectedDoctor?.doctor?.id],
    queryFn: async () => {
      if (!currentClinic?.id || !selectedDoctor?.doctor?.id) return null;
      return getDoctorDepartureInfo(selectedDoctor.doctor.id, currentClinic.id);
    },
    enabled: !!currentClinic?.id && !!selectedDoctor?.doctor?.id,
  });

  // Remove doctor instantly without approval
  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor?.doctor?.id || !currentClinic?.id) {
        throw new Error('Выберите врача');
      }

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      // Import and use doctor departure logic
      const { handleDoctorDeparture, deactivateDoctorAffiliation } = await import('@/lib/doctor-departure');
      
      // Handle patient ownership based on cooperation type
      const departureResult = await handleDoctorDeparture(selectedDoctor.doctor.id, currentClinic.id);
      console.log('Departure result:', departureResult);

      // Deactivate affiliation
      await deactivateDoctorAffiliation(selectedDoctor.doctor.id, currentClinic.id);

      // Remove from clinic_members
      await supabase
        .from('clinic_members')
        .delete()
        .eq('user_id', selectedDoctor.user_id)
        .eq('clinic_id', currentClinic.id)
        .eq('role', 'doctor');

      // Clear doctor's clinic_id if matches
      const { data: doctor } = await supabase
        .from('doctors')
        .select('clinic_id')
        .eq('id', selectedDoctor.doctor.id)
        .single();

      if (doctor?.clinic_id === currentClinic.id) {
        await supabase.from('doctors').update({ clinic_id: null }).eq('id', selectedDoctor.doctor.id);
      }

      return departureResult;
    },
    onSuccess: (result) => {
      const message = result?.message 
        ? `Врач удален из клиники. ${result.message}`
        : 'Врач удален из клиники';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-doctors-for-removal'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      setSelectedDoctor(null);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Ошибка', { description: error.message });
    },
  });

  const getCooperationBadge = (type: string) => {
    if (type === 'chair_rental') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                <Armchair className="h-3 w-3 mr-1" />
                Арендатор
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">При уходе пациенты уйдут с врачом</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <Building2 className="h-3 w-3 mr-1" />
              Штатный
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">При уходе пациенты остаются в клинике</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            Удалить врача из клиники
          </DialogTitle>
          <DialogDescription>
            Выберите врача для немедленного удаления из клиники.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingDoctors ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clinicDoctors?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              В клинике нет врачей
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {clinicDoctors?.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDoctor?.id === item.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedDoctor(item)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.profile?.avatar_url || ''} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.profile?.full_name || 'Врач'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Stethoscope className="h-3 w-3" />
                        <span>{item.doctor?.specialty}</span>
                      </div>
                    </div>
                    {getCooperationBadge(item.cooperationType)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDoctor && (
            <>
              {/* Show what will happen with patients */}
              {loadingDepartureInfo ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : departureInfo && (
                <div className={`p-3 rounded-lg border ${
                  departureInfo.willPatientsStay 
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {departureInfo.willPatientsStay ? (
                      <Info className="h-4 w-4 mt-0.5 text-blue-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                    )}
                    <div className="text-sm">
                      <p className="font-medium">
                        {departureInfo.willPatientsStay 
                          ? 'Штатный врач' 
                          : 'Арендатор кресла'}
                      </p>
                      <p className="text-muted-foreground">
                        {departureInfo.patientsCount > 0 ? (
                          departureInfo.willPatientsStay ? (
                            <>
                              <Users className="h-3 w-3 inline mr-1" />
                              {departureInfo.patientsCount} пациентов останутся в клинике
                            </>
                          ) : (
                            <>
                              <Users className="h-3 w-3 inline mr-1" />
                              {departureInfo.patientsCount} пациентов уйдут с врачом
                            </>
                          )
                        ) : (
                          'Нет привязанных пациентов'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
                  <p>Врач будет удален из клиники немедленно и потеряет доступ к CRM.</p>
                </div>
              </div>
            </>
          )}

          <Button
            className="w-full"
            variant="destructive"
            disabled={!selectedDoctor || removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            {removeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserMinus className="h-4 w-4 mr-2" />
            )}
            Удалить врача
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}