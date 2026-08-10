import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Check, User } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  invalidateClinicServiceAssignmentQueries,
  listClinicServiceDoctorAssignments,
  syncClinicServiceDoctorAssignments,
} from '@/lib/clinic-service-assignments-api';

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface Doctor {
  doctor_id: string;
  doctors: {
    id: string;
    specialty: string | null;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

interface AssignServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  clinicId: string;
  doctors: Doctor[];
}

export function AssignServiceDialog({
  open,
  onOpenChange,
  service,
  clinicId,
  doctors,
}: AssignServiceDialogProps) {
  const { t } = useLanguage();
  const { canEdit } = useModulePermissions();
  const queryClient = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  // Fetch existing assignments for this service
  const { data: assignments } = useQuery({
    queryKey: ['service-assignments', clinicId, service?.id],
    queryFn: async () => {
      if (!service?.id) return [];

      return listClinicServiceDoctorAssignments(clinicId, service.id);
    },
    enabled: !!service?.id && open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedDoctor('');
    }
  }, [open]);

  const assignMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      if (!service) throw new Error(t('crmServiceDialogs.noServicesSelected'));
      if (!canEdit('services')) throw new Error(t('crm.accessDenied'));
      const active = (assignments ?? []).filter((item) => item.isActive);
      const existing = active.find((item) => item.doctorId === doctorId);
      const desired = existing
        ? active.filter((item) => item.doctorId !== doctorId)
        : [...active, { doctorId, customPrice: null }];
      await syncClinicServiceDoctorAssignments(
        clinicId,
        service.id,
        desired.map((item) => ({ doctorId: item.doctorId, customPrice: item.customPrice })),
      );
    },
    onSuccess: async () => {
      await invalidateClinicServiceAssignmentQueries(queryClient);
      toast.success(t('managerRole.assignmentUpdated'));
    },
    onError: () => {
      toast.error(t('managerRole.assignError'));
    },
  });

  if (!service) return null;

  const assignedDoctorIds = new Set(
    assignments?.filter(a => a.isActive).map(a => a.doctorId) || []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('managerRole.assignTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Info */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium">{service.name}</h4>
            <p className="text-sm text-muted-foreground">
              {service.category} • {formatPrice(service.price)}
            </p>
          </div>

          {/* Quick Select */}
          <div className="flex gap-2">
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('managerRole.assignSelectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.doctor_id} value={d.doctor_id}>
                    {d.doctors.profiles.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (selectedDoctor) {
                  assignMutation.mutate(selectedDoctor);
                  setSelectedDoctor('');
                }
              }}
              disabled={
                !selectedDoctor
                || assignMutation.isPending
                || !canEdit('services')
              }
            >
              {t('managerRole.assignBtn')}
            </Button>
          </div>

          {/* Doctors List */}
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {doctors.map((doctor) => {
                const isAssigned = assignedDoctorIds.has(doctor.doctor_id);

                return (
                  <button
                    key={doctor.doctor_id}
                    onClick={() => assignMutation.mutate(doctor.doctor_id)}
                    disabled={assignMutation.isPending || !canEdit('services')}
                    title={!canEdit('services') ? t('crm.accessDenied') : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                      isAssigned
                        ? "border-primary bg-primary/5 hover:bg-primary/10"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={doctor.doctors.profiles.avatar_url || ''} />
                      <AvatarFallback>
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{doctor.doctors.profiles.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {doctor.doctors.specialty || t('managerRole.assignDefaultSpecialty')}
                      </div>
                    </div>
                    {isAssigned && (
                      <div className="flex items-center gap-1 text-primary text-sm">
                        <Check className="w-4 h-4" />
                        {t('managerRole.assignAssigned')}
                      </div>
                    )}
                  </button>
                );
              })}

              {doctors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('managerRole.assignNoDoctors')}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('managerRole.assignDoneBtn')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
