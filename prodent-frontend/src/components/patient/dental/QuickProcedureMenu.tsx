import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Stethoscope, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickProcedureMenuProps {
  patientId: string;
  toothNumber: number;
  treatmentPlanId?: string;
  doctorId?: string;
  onProcedureAdded?: () => void;
}

export function QuickProcedureMenu({ 
  patientId, 
  toothNumber, 
  treatmentPlanId,
  doctorId,
  onProcedureAdded
}: QuickProcedureMenuProps) {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Получаем услуги клиники
  const { data: services } = useQuery({
    queryKey: ['clinic-services', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('category', { ascending: true });
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Получаем планы лечения пациента (treatment_plans - это отдельные записи процедур, группируем по service_name)
  const { data: treatmentPlans } = useQuery({
    queryKey: ['patient-treatment-plans-grouped', patientId, currentClinic?.id],
    queryFn: async () => {
      if (!patientId || !currentClinic?.id) return [];
      const { data } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'planned')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!patientId && !!currentClinic?.id,
  });

  // Мутация для добавления в plan_items (treatment_plan_items)
  const addToPlanMutation = useMutation({
    mutationFn: async ({ serviceName, price }: { 
      serviceName: string;
      price: number;
    }) => {
      // Создаём запись в treatment_plans
      const { error } = await supabase
        .from('treatment_plans')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          clinic_id: currentClinic?.id,
          service_name: serviceName,
          tooth_number: toothNumber,
          price,
          status: 'planned',
          planned_date: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Процедура добавлена для зуба #${toothNumber}`);
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      queryClient.invalidateQueries({ queryKey: ['patient-treatment-plans-grouped'] });
      setIsOpen(false);
      onProcedureAdded?.();
    },
    onError: () => {
      toast.error('Ошибка добавления процедуры');
    },
  });

  // Мутация для записи в историю зуба
  const addToHistoryMutation = useMutation({
    mutationFn: async ({ serviceName, status }: { serviceName: string; status: string }) => {
      const { error } = await supabase
        .from('tooth_history')
        .insert({
          patient_id: patientId,
          tooth_number: toothNumber,
          status_after: status,
          procedure_name: serviceName,
          doctor_id: doctorId,
          clinic_id: currentClinic?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tooth-history', patientId, toothNumber] });
    },
  });

  const handleAddProcedure = (service: any) => {
    addToPlanMutation.mutate({
      serviceName: service.name,
      price: service.price || 0,
    });
  };

  // Группируем услуги по категориям
  const servicesByCategory = services?.reduce((acc, service) => {
    const category = service.category || 'Другое';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const isLoading = addToPlanMutation.isPending;

  if (!currentClinic) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          В план лечения
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Добавить процедуру для зуба #{toothNumber}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Услуги для добавления */}
        {services && services.length > 0 ? (
          Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-1">
                {category}
              </DropdownMenuLabel>
              {categoryServices.map(service => (
                <DropdownMenuItem
                  key={service.id}
                  onClick={() => handleAddProcedure(service)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{service.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {service.price?.toLocaleString()} сум
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          ))
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <p>Нет активных планов лечения</p>
            <p className="text-xs mt-1">Сначала создайте план лечения для пациента</p>
          </div>
        )}

        {/* Быстрые действия без плана */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Быстрые статусы
        </DropdownMenuLabel>
        {[
          { status: 'filling', label: 'Пломба установлена', icon: '🔵' },
          { status: 'crown', label: 'Коронка установлена', icon: '👑' },
          { status: 'endo', label: 'Эндодонтия', icon: '🔴' },
          { status: 'healthy', label: 'Вылечен', icon: '✅' },
        ].map(item => (
          <DropdownMenuItem
            key={item.status}
            onClick={() => addToHistoryMutation.mutate({ 
              serviceName: item.label, 
              status: item.status 
            })}
            className="cursor-pointer"
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
