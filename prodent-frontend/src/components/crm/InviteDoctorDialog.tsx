import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { useLanguage } from '@/contexts/LanguageContext';
import {
  createDoctorClinicRequest,
  normalizeDoctorClinicRequestStatus,
} from '@/lib/doctor-clinic-requests-api';

type DoctorProfile = {
  id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
};

type InviteDoctorResult = {
  id: string;
  specialty?: string | null;
  experience_years?: number | null;
  rating?: number | null;
  verified?: boolean | null;
  user_id?: string | null;
  clinic_id?: string | null;
  profile?: DoctorProfile | DoctorProfile[] | null;
  email?: string | null;
};

type SupabaseAuthWithOptionalAdmin = typeof supabase.auth & {
  admin?: {
    getUserById?: (userId: string) => Promise<{ data?: { user?: { email?: string | null } | null } | null }>;
  };
};

type MutationError = { message?: string } | Error | unknown;

const getDoctorProfile = (doctor: InviteDoctorResult): DoctorProfile | null => {
  if (Array.isArray(doctor.profile)) return doctor.profile[0] ?? null;
  return doctor.profile ?? null;
};

interface InviteDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function InviteDoctorDialog({ open, onOpenChange, clinicId }: InviteDoctorDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<InviteDoctorResult | null>(null);
  const [message, setMessage] = useState('');
  // Cooperation terms the clinic offers the doctor (carried on the invitation).
  const [cooperationType, setCooperationType] = useState<'staff_doctor' | 'chair_rental' | ''>('');
  // Staff pay model: % share, fixed monthly salary, by agreement, or unpaid intern.
  const [salaryMode, setSalaryMode] = useState<'percent' | 'fixed' | 'agreement' | 'intern'>('percent');
  const [salaryPercent, setSalaryPercent] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  // Rental terms: a fixed fee, free, or negotiable ("по соглашению").
  const [rentalMode, setRentalMode] = useState<'fixed' | 'free' | 'negotiable'>('fixed');
  const [rentalFee, setRentalFee] = useState('');
  const [rentalPeriod, setRentalPeriod] = useState('monthly');

  const resetForm = () => {
    setSelectedDoctor(null);
    setMessage('');
    setSearchQuery('');
    setCooperationType('');
    setSalaryMode('percent');
    setSalaryPercent('');
    setSalaryAmount('');
    setRentalMode('fixed');
    setRentalFee('');
    setRentalPeriod('monthly');
  };

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
        const profile = getDoctorProfile(doctor as InviteDoctorResult);
        const fullName = profile?.full_name?.toLowerCase() || '';
        const queryLower = searchQuery.toLowerCase();
        
        // Check if name matches
        if (fullName.includes(queryLower)) {
          // Get email from auth
          const { data: userData } =
            (doctor.user_id
              ? await (supabase.auth as SupabaseAuthWithOptionalAdmin).admin?.getUserById?.(doctor.user_id)
              : null) || { data: null };
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
      return ((doctorsByName || []) as InviteDoctorResult[]).filter(d => {
        const profile = getDoctorProfile(d);
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
        .in('status', ['pending', 'approved', 'PENDING', 'APPROVED']);

      const { data: members } = await supabase
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', clinicId)
        .eq('role', 'doctor');

      return {
        pendingDoctorIds: requests
          ?.filter((request) => normalizeDoctorClinicRequestStatus(request.status) === 'pending')
          .map((request) => request.doctor_id) || [],
        memberUserIds: members?.map(m => m.user_id) || [],
      };
    },
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor) throw new Error(t('crmDoctorMgmt.doctorPlaceholder'));

      await createDoctorClinicRequest({
        doctorId: selectedDoctor.id,
        clinicId,
        requestType: 'clinic_to_doctor',
        message: message || null,
        cooperationType: cooperationType || null,
        salaryMode: cooperationType === 'staff_doctor' ? salaryMode : null,
        salaryPercent: cooperationType === 'staff_doctor' && salaryMode === 'percent' && salaryPercent
          ? Number(salaryPercent)
          : null,
        salaryAmount: cooperationType === 'staff_doctor' && salaryMode === 'fixed' && salaryAmount
          ? Number(salaryAmount)
          : null,
        rentalFee: cooperationType === 'chair_rental'
          ? (rentalMode === 'free' ? 0 : (rentalMode === 'fixed' && rentalFee ? Number(rentalFee) : null))
          : null,
        rentalPeriod: cooperationType === 'chair_rental'
          ? (rentalMode === 'negotiable' ? 'negotiable' : (rentalMode === 'fixed' ? rentalPeriod : null))
          : null,
      });
    },
    onSuccess: () => {
      toast.success(t('crmDoctorMgmt.inviteSent'));
      queryClient.invalidateQueries({ queryKey: ['doctor-clinic-relations'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-invitations'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: MutationError) => {
      toast.error(t('crmDoctorMgmt.inviteError'), { description: error instanceof Error ? error.message : undefined });
    },
  });

  const isDoctorAlreadyInvited = (doctorId: string) => {
    return existingRelations?.pendingDoctorIds?.includes(doctorId);
  };

  const isDoctorAlreadyMember = (doctor: InviteDoctorResult) => {
    return existingRelations?.memberUserIds?.includes(doctor.user_id) || doctor.clinic_id === clinicId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('crmDoctorMgmt.inviteTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('crmDoctorMgmt.inviteDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label>{t('crmDoctorMgmt.doctorPlaceholder')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('crmDoctorMgmt.doctorEmailPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedDoctor(null);
                }}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('crmPatientComponents.searchPlaceholder')}
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
              <Label>{t('crmDoctorMgmt.doctorPlaceholder')}</Label>
              {searchResults.map((doctor: InviteDoctorResult) => {
                const profile = getDoctorProfile(doctor);
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
                          {profile?.full_name || t('crmDoctorMgmt.doctorName')}
                        </span>
                        {doctor.verified && (
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {doctor.specialty}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doctor.experience_years} {t('doctorAbout.yearsExp')}</span>
                        {doctor.rating && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-rating text-rating" />
                              {doctor.rating}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isInvited && (
                      <Badge variant="secondary">{t('doctorClinicInvitations.pending')}</Badge>
                    )}
                    {isMember && (
                      <Badge variant="default">{t('doctorClinicInvitations.accepted')}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 3 && !isSearching && searchResults?.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {t('crmPatientComponents.noResults')}
            </p>
          )}

          {/* Selected Doctor */}
          {selectedDoctor && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={getDoctorProfile(selectedDoctor)?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {getDoctorProfile(selectedDoctor)?.full_name?.charAt(0) || 'D'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {getDoctorProfile(selectedDoctor)?.full_name}
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
                    {t('doctorReviews.edit')}
                  </Button>
                </div>
              </div>

              {/* Cooperation type the clinic offers */}
              <div className="space-y-2">
                <Label>Тип сотрудничества <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={cooperationType === 'staff_doctor' ? 'default' : 'outline'}
                    onClick={() => setCooperationType('staff_doctor')}
                  >
                    Штатный врач
                  </Button>
                  <Button
                    type="button"
                    variant={cooperationType === 'chair_rental' ? 'default' : 'outline'}
                    onClick={() => setCooperationType('chair_rental')}
                  >
                    Аренда кресла
                  </Button>
                </div>
              </div>

              {cooperationType === 'staff_doctor' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Оплата</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant={salaryMode === 'percent' ? 'default' : 'outline'} onClick={() => setSalaryMode('percent')}>
                        Процент
                      </Button>
                      <Button type="button" variant={salaryMode === 'fixed' ? 'default' : 'outline'} onClick={() => setSalaryMode('fixed')}>
                        Фикс. зарплата
                      </Button>
                      <Button type="button" variant={salaryMode === 'agreement' ? 'default' : 'outline'} onClick={() => setSalaryMode('agreement')}>
                        По соглашению
                      </Button>
                      <Button type="button" variant={salaryMode === 'intern' ? 'default' : 'outline'} onClick={() => setSalaryMode('intern')}>
                        Интерн
                      </Button>
                    </div>
                  </div>
                  {salaryMode === 'percent' && (
                    <div className="space-y-2">
                      <Label htmlFor="invite-doctor-dialog-field-1">Доля клиники, %</Label>
                      <Input id="invite-doctor-dialog-field-1"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="40"
                        value={salaryPercent}
                        onChange={(e) => setSalaryPercent(e.target.value)}
                      />
                    </div>
                  )}
                  {salaryMode === 'fixed' && (
                    <div className="space-y-2">
                      <Label htmlFor="invite-doctor-dialog-field-2">Зарплата, сум / мес</Label>
                      <Input id="invite-doctor-dialog-field-2"
                        type="number"
                        min="0"
                        placeholder="5000000"
                        value={salaryAmount}
                        onChange={(e) => setSalaryAmount(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {cooperationType === 'chair_rental' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Условия аренды</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button type="button" variant={rentalMode === 'fixed' ? 'default' : 'outline'} onClick={() => setRentalMode('fixed')}>
                        Сумма
                      </Button>
                      <Button type="button" variant={rentalMode === 'free' ? 'default' : 'outline'} onClick={() => setRentalMode('free')}>
                        Бесплатно
                      </Button>
                      <Button type="button" variant={rentalMode === 'negotiable' ? 'default' : 'outline'} onClick={() => setRentalMode('negotiable')}>
                        По соглашению
                      </Button>
                    </div>
                  </div>
                  {rentalMode === 'fixed' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="invite-doctor-dialog-field-3">Аренда, сум</Label>
                        <Input id="invite-doctor-dialog-field-3"
                          type="number"
                          min="0"
                          placeholder="2000000"
                          value={rentalFee}
                          onChange={(e) => setRentalFee(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Период</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={rentalPeriod}
                          onChange={(e) => setRentalPeriod(e.target.value)}
                        >
                          <option value="monthly">в месяц</option>
                          <option value="daily">в день</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invite-doctor-dialog-field-4">{t('crmDoctorMgmt.message')}</Label>
                <Textarea id="invite-doctor-dialog-field-4"
                  placeholder={t('crmDoctorMgmt.messagePlaceholder')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !cooperationType}
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('crmDoctorMgmt.sending')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('crmDoctorMgmt.sendInvite')}
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
