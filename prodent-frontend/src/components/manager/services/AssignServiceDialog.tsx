import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const queryClient = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  // Fetch existing assignments for this service
  const { data: assignments } = useQuery({
    queryKey: ['service-assignments', service?.id],
    queryFn: async () => {
      if (!service?.id) return [];
      
      const { data, error } = await supabase
        .from('clinic_doctor_services')
        .select(`
          id,
          doctor_id,
          custom_price,
          is_active
        `)
        .eq('service_id', service.id)
        .eq('clinic_id', clinicId);

      if (error) throw error;
      return data;
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
      // Check if already assigned
      const existing = assignments?.find(a => a.doctor_id === doctorId);
      
      if (existing) {
        // Toggle active state
        const { error } = await supabase
          .from('clinic_doctor_services')
          .update({ is_active: !existing.is_active })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('clinic_doctor_services')
          .insert({
            service_id: service!.id,
            doctor_id: doctorId,
            clinic_id: clinicId,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-assignments', service?.id] });
      toast.success('Назначение обновлено');
    },
    onError: () => {
      toast.error('Ошибка при назначении');
    },
  });

  if (!service) return null;

  const assignedDoctorIds = new Set(
    assignments?.filter(a => a.is_active).map(a => a.doctor_id) || []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Назначить врачам
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
                <SelectValue placeholder="Выберите врача для назначения" />
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
              disabled={!selectedDoctor || assignMutation.isPending}
            >
              Назначить
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
                    disabled={assignMutation.isPending}
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
                        {doctor.doctors.specialty || 'Стоматолог'}
                      </div>
                    </div>
                    {isAssigned && (
                      <div className="flex items-center gap-1 text-primary text-sm">
                        <Check className="w-4 h-4" />
                        Назначена
                      </div>
                    )}
                  </button>
                );
              })}

              {doctors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Нет врачей для назначения
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Готово
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
