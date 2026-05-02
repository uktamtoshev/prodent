import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, UserPlus, Loader2, Mail, AtSign, CheckCircle, Star } from 'lucide-react';

interface InviteDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function InviteDoctorDialog({ open, onOpenChange, clinicId }: InviteDoctorDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [message, setMessage] = useState('');

  // Search doctors by email or name
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search-doctors-for-invite', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];

      // Search by email in profiles or by name
      const { data: doctors, error } = await supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          rating,
          verified,
          user_id,
          profile:profiles!doctors_user_id_fkey(
            id,
            full_name,
            avatar_url,
            phone
          )
        `)
        .limit(10);

      if (error) throw error;

      // Filter by search query (name or check email separately)
      const filteredDoctors = [];
      
      for (const doctor of doctors || []) {
        const profile = doctor.profile as any;
        const fullName = profile?.full_name?.toLowerCase() || '';
        const queryLower = searchQuery.toLowerCase();
        
        // Check if name matches
        if (fullName.includes(queryLower)) {
          // Get email from auth
          const { data: userData } = await supabase.auth.admin?.getUserById?.(doctor.user_id) || { data: null };
          filteredDoctors.push({
            ...doctor,
            email: userData?.user?.email || null
          });
          continue;
        }
        
        // Check email match - we need to query it differently
        // For now, just search by name - email search would need an edge function
        if (searchQuery.includes('@')) {
          // Try to find user by email
          const { data: profileByPhone } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', doctor.user_id)
            .single();
            
          if (profileByPhone) {
            filteredDoctors.push(doctor);
          }
        }
      }

      // Simple approach: just search by name in profiles
      const { data: doctorsByName, error: nameError } = await supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          rating,
          verified,
          user_id,
          clinic_id,
          profile:profiles!doctors_user_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .limit(10);

      if (nameError) throw nameError;

      // Filter by name containing query
      return (doctorsByName || []).filter(d => {
        const profile = d.profile as any;
        const name = profile?.full_name?.toLowerCase() || '';
        return name.includes(searchQuery.toLowerCase());
      });
    },
    enabled: searchQuery.length >= 3,
  });

  // Check if already invited or member
  const { data: existingRelations } = useQuery({
    queryKey: ['doctor-clinic-relations', clinicId],
    queryFn: async () => {
      const { data: requests } = await supabase
        .from('doctor_clinic_requests')
        .select('doctor_id, status')
        .eq('clinic_id', clinicId)
        .in('status', ['pending', 'approved']);

      const { data: members } = await supabase
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', clinicId)
        .eq('role', 'doctor');

      return {
        pendingDoctorIds: requests?.filter(r => r.status === 'pending').map(r => r.doctor_id) || [],
        memberUserIds: members?.map(m => m.user_id) || [],
      };
    },
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor) throw new Error('Выберите врача');

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Не авторизован');

      const { error } = await supabase
        .from('doctor_clinic_requests')
        .insert({
          doctor_id: selectedDoctor.id,
          clinic_id: clinicId,
          request_type: 'clinic_to_doctor',
          invited_by: user.id,
          message: message || null,
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Приглашение отправлено врачу');
      queryClient.invalidateQueries({ queryKey: ['doctor-clinic-relations'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-invitations'] });
      setSelectedDoctor(null);
      setMessage('');
      setSearchQuery('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Ошибка', { description: error.message });
    },
  });

  const isDoctorAlreadyInvited = (doctorId: string) => {
    return existingRelations?.pendingDoctorIds?.includes(doctorId);
  };

  const isDoctorAlreadyMember = (doctor: any) => {
    return existingRelations?.memberUserIds?.includes(doctor.user_id) || doctor.clinic_id === clinicId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Пригласить врача в клинику
          </DialogTitle>
          <DialogDescription>
            Найдите врача по имени или email и отправьте приглашение
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label>Поиск врача</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Введите имя или email врача..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedDoctor(null);
                }}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Минимум 3 символа для поиска
            </p>
          </div>

          {/* Search Results */}
          {isSearching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchResults && searchResults.length > 0 && !selectedDoctor && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <Label>Результаты поиска</Label>
              {searchResults.map((doctor: any) => {
                const profile = doctor.profile as any;
                const isInvited = isDoctorAlreadyInvited(doctor.id);
                const isMember = isDoctorAlreadyMember(doctor);

                return (
                  <div
                    key={doctor.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isInvited || isMember
                        ? 'opacity-50 cursor-not-allowed bg-muted'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => {
                      if (!isInvited && !isMember) {
                        setSelectedDoctor(doctor);
                      }
                    }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback>
                        {profile?.full_name?.charAt(0) || 'D'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {profile?.full_name || 'Без имени'}
                        </span>
                        {doctor.verified && (
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {doctor.specialty}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doctor.experience_years} лет опыта</span>
                        {doctor.rating && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {doctor.rating}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isInvited && (
                      <Badge variant="secondary">Приглашён</Badge>
                    )}
                    {isMember && (
                      <Badge variant="default">В клинике</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 3 && !isSearching && searchResults?.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Врачи не найдены
            </p>
          )}

          {/* Selected Doctor */}
          {selectedDoctor && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={(selectedDoctor.profile as any)?.avatar_url} />
                    <AvatarFallback>
                      {(selectedDoctor.profile as any)?.full_name?.charAt(0) || 'D'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {(selectedDoctor.profile as any)?.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDoctor.specialty}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setSelectedDoctor(null)}
                  >
                    Изменить
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Сообщение (необязательно)</Label>
                <Textarea
                  placeholder="Напишите сообщение для врача..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Отправить приглашение
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
