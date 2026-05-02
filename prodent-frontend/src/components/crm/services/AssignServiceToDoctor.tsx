import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
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
  doctors?: any[];
}

export function AssignServiceToDoctor({ 
  open, 
  onOpenChange, 
  service, 
  clinicId,
  doctors 
}: AssignServiceToDoctorProps) {
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Record<string, { assigned: boolean; customPrice: string }>>({});

  // Fetch existing assignments
  const { data: existingAssignments } = useQuery({
    queryKey: ['service-doctor-assignments', service.id, clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from('clinic_doctor_services')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('service_id', service.id);

      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  // Initialize assignments state
  useEffect(() => {
    if (doctors && existingAssignments) {
      const newAssignments: Record<string, { assigned: boolean; customPrice: string }> = {};
      
      doctors.forEach((doc) => {
        const doctorId = doc.doctor_id;
        const existing = existingAssignments.find(a => a.doctor_id === doctorId);
        newAssignments[doctorId] = {
          assigned: !!existing,
          customPrice: existing?.custom_price?.toString() || '',
        };
      });
      
      setAssignments(newAssignments);
    }
  }, [doctors, existingAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error('Clinic not selected');

      // Get all doctor IDs that should be assigned
      const toAssign = Object.entries(assignments)
        .filter(([_, value]) => value.assigned)
        .map(([doctorId, value]) => ({
          clinic_id: clinicId,
          doctor_id: doctorId,
          service_id: service.id,
          custom_price: value.customPrice ? parseInt(value.customPrice) : null,
        }));

      // Get all doctor IDs that should be removed
      const toRemove = Object.entries(assignments)
        .filter(([_, value]) => !value.assigned)
        .map(([doctorId]) => doctorId);

      // Delete unassigned
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('clinic_doctor_services')
          .delete()
          .eq('clinic_id', clinicId)
          .eq('service_id', service.id)
          .in('doctor_id', toRemove);
        if (error) throw error;
      }

      // Upsert assigned
      if (toAssign.length > 0) {
        const { error } = await supabase
          .from('clinic_doctor_services')
          .upsert(toAssign, { 
            onConflict: 'clinic_id,doctor_id,service_id',
            ignoreDuplicates: false 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-doctor-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-clinic-services'] });
      toast.success('Назначения сохранены');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving assignments:', error);
      toast.error('Ошибка при сохранении');
    },
  });

  const toggleDoctor = (doctorId: string) => {
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
            Назначить услугу врачам
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{service.name}</span>
            <span className="mx-2">•</span>
            <span>{formatPrice(service.price, service.currency === 'USD' ? '$' : 'сум')}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {!doctors?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет врачей в клинике
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
                  />
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {profile?.full_name || 'Врач'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {doctor?.specialty}
                    </div>
                  </div>

                  {assignment?.assigned && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Своя цена:
                      </Label>
                      <Input
                        value={assignment?.customPrice || ''}
                        onChange={(e) => updateCustomPrice(doctorId, e.target.value)}
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
            Выбрано: {assignedCount} из {doctors?.length || 0}
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}