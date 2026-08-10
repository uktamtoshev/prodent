import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  invalidateClinicServiceAssignmentQueries,
  listClinicServiceDoctorAssignments,
  syncClinicServiceDoctorAssignments,
} from '@/lib/clinic-service-assignments-api';

interface ClinicDoctorOption {
  doctor_id: string;
  doctors?: {
    specialty?: string | null;
    profiles?: {
      full_name?: string | null;
      avatar_url?: string | null;
    } | null;
  } | null;
}

interface AssignServiceToDoctorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: {
    id: string;
    name: string;
    price: number;
    currency?: string;
  };
  clinicId?: string;
  doctors?: ClinicDoctorOption[];
}

export function AssignServiceToDoctor({
  open,
  onOpenChange,
  service,
  clinicId,
  doctors
}: AssignServiceToDoctorProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { canEdit } = useModulePermissions();
  const [assignments, setAssignments] = useState<Record<string, { assigned: boolean; customPrice: string }>>({});

  // Fetch existing assignments
  const { data: existingAssignments } = useQuery({
    queryKey: ['service-doctor-assignments', service.id, clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      return listClinicServiceDoctorAssignments(clinicId, service.id);
    },
    enabled: open && !!clinicId,
  });

  // Initialize assignments state
  useEffect(() => {
    if (doctors && existingAssignments) {
      const newAssignments: Record<string, { assigned: boolean; customPrice: string }> = {};

      doctors.forEach((doc) => {
        const doctorId = doc.doctor_id;
        const existing = existingAssignments.find(a => a.doctorId === doctorId);
        newAssignments[doctorId] = {
          assigned: Boolean(existing?.isActive),
          customPrice: existing?.customPrice?.toString() || '',
        };
      });

      setAssignments(newAssignments);
    }
  }, [doctors, existingAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error('Clinic not selected');
      if (!canEdit('services')) throw new Error(t('crm.accessDenied'));

      const desired = Object.entries(assignments)
        .filter(([, value]) => value.assigned)
        .map(([doctorId, value]) => ({
          doctorId,
          customPrice: value.customPrice ? Number(value.customPrice) : null,
        }));
      await syncClinicServiceDoctorAssignments(clinicId, service.id, desired);
    },
    onSuccess: async () => {
      await invalidateClinicServiceAssignmentQueries(queryClient);
      toast.success(t('crmServiceDialogs.assignmentsSaved'));
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving assignments:', error);
      toast.error(t('crmServiceDialogs.saveError'));
    },
  });

  const toggleDoctor = (doctorId: string) => {
    if (!canEdit('services')) return;
    setAssignments(prev => ({
      ...prev,
      [doctorId]: {
        ...prev[doctorId],
        assigned: !prev[doctorId]?.assigned,
      },
    }));
  };

  const updateCustomPrice = (doctorId: string, price: string) => {
    setAssignments(prev => ({
      ...prev,
      [doctorId]: {
        ...prev[doctorId],
        customPrice: price.replace(/\D/g, ''),
      },
    }));
  };

  const assignedCount = Object.values(assignments).filter(a => a.assigned).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t('crmServiceDialogs.assignToDoctorsBtn')}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{service.name}</span>
            <span className="mx-2">•</span>
            <span>{formatPrice(service.price, service.currency === 'USD' ? '$' : t('crmServiceDialogs.currencySom'))}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {!doctors?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('crmServiceDialogs.noDoctorsInClinic')}
            </div>
          ) : (
            doctors.map((doc) => {
              const doctorId = doc.doctor_id;
              const profile = doc.doctors?.profiles;
              const doctor = doc.doctors;
              const assignment = assignments[doctorId];

              return (
                <div
                  key={doctorId}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={assignment?.assigned || false}
                    onCheckedChange={() => toggleDoctor(doctorId)}
                    disabled={!canEdit('services')}
                    title={!canEdit('services') ? t('crm.accessDenied') : undefined}
                  />

                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {profile?.full_name || t('crmServiceDialogs.doctor')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {doctor?.specialty}
                    </div>
                  </div>

                  {assignment?.assigned && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap" htmlFor="assign-service-to-doctor-field-1">
                        {t('crmServiceDialogs.customPrice')}
                      </Label>
                      <Input id="assign-service-to-doctor-field-1"
                        value={assignment?.customPrice || ''}
                        onChange={(e) => updateCustomPrice(doctorId, e.target.value)}
                        disabled={!canEdit('services')}
                        placeholder={service.price.toString()}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Badge variant="secondary">
            {t('crmServiceDialogs.selectedFromTotal')}: {assignedCount} {t('crmServiceDialogs.ofTotal')} {doctors?.length || 0}
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !canEdit('services')}
            >
              {saveMutation.isPending ? t('crmServiceDialogs.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
