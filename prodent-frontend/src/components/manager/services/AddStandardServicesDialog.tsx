import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ListPlus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddStandardServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  existingServiceNames: string[];
}

// Standard dental services organized by category
const standardServicesData: Record<string, Array<{ name: string; duration: number }>> = {
  'Консультация': [
    { name: 'Первичная консультация', duration: 30 },
    { name: 'Повторная консультация', duration: 20 },
    { name: 'Консультация ортодонта', duration: 45 },
    { name: 'Консультация хирурга', duration: 30 },
    { name: 'Консультация имплантолога', duration: 45 },
  ],
  'Диагностика': [
    { name: 'Панорамный снимок (ОПТГ)', duration: 15 },
    { name: 'Прицельный рентген-снимок', duration: 10 },
    { name: 'Компьютерная томография (КТ)', duration: 20 },
    { name: '3D сканирование зубов', duration: 30 },
  ],
  'Терапия': [
    { name: 'Лечение кариеса', duration: 45 },
    { name: 'Лечение пульпита', duration: 60 },
    { name: 'Лечение периодонтита', duration: 60 },
    { name: 'Пломба светоотверждаемая', duration: 40 },
    { name: 'Реставрация зуба', duration: 60 },
    { name: 'Эндодонтическое лечение (1 канал)', duration: 45 },
    { name: 'Эндодонтическое лечение (2 канала)', duration: 60 },
    { name: 'Эндодонтическое лечение (3+ каналов)', duration: 90 },
  ],
  'Профилактика': [
    { name: 'Профессиональная чистка зубов', duration: 60 },
    { name: 'Ультразвуковая чистка', duration: 45 },
    { name: 'Air Flow', duration: 40 },
    { name: 'Фторирование зубов', duration: 30 },
    { name: 'Герметизация фиссур', duration: 30 },
  ],
  'Хирургия': [
    { name: 'Удаление зуба простое', duration: 30 },
    { name: 'Удаление зуба сложное', duration: 60 },
    { name: 'Удаление зуба мудрости', duration: 90 },
    { name: 'Резекция верхушки корня', duration: 60 },
    { name: 'Пластика уздечки губы', duration: 30 },
    { name: 'Синус-лифтинг закрытый', duration: 90 },
    { name: 'Синус-лифтинг открытый', duration: 120 },
  ],
  'Имплантация': [
    { name: 'Имплантация (1 имплант)', duration: 60 },
    { name: 'Установка формирователя десны', duration: 30 },
    { name: 'Костная пластика', duration: 90 },
    { name: 'Установка абатмента', duration: 30 },
  ],
  'Ортопедия': [
    { name: 'Металлокерамическая коронка', duration: 45 },
    { name: 'Циркониевая коронка', duration: 45 },
    { name: 'Керамическая коронка E-max', duration: 45 },
    { name: 'Временная коронка', duration: 30 },
    { name: 'Винир керамический', duration: 60 },
    { name: 'Мостовидный протез (1 единица)', duration: 45 },
    { name: 'Съёмный протез частичный', duration: 60 },
    { name: 'Съёмный протез полный', duration: 60 },
  ],
  'Ортодонтия': [
    { name: 'Установка брекет-системы (металлическая)', duration: 120 },
    { name: 'Установка брекет-системы (керамическая)', duration: 120 },
    { name: 'Элайнеры (полный курс)', duration: 60 },
    { name: 'Активация брекет-системы', duration: 45 },
    { name: 'Снятие брекет-системы', duration: 60 },
    { name: 'Ретейнер несъёмный', duration: 45 },
  ],
  'Эстетика': [
    { name: 'Отбеливание зубов (кабинетное)', duration: 90 },
    { name: 'Отбеливание зубов (домашнее)', duration: 30 },
    { name: 'Художественная реставрация', duration: 90 },
  ],
  'Детская стоматология': [
    { name: 'Лечение молочного зуба', duration: 30 },
    { name: 'Удаление молочного зуба', duration: 20 },
    { name: 'Серебрение зубов', duration: 20 },
    { name: 'Пломба на молочный зуб', duration: 30 },
  ],
};

const categoryColors: Record<string, string> = {
  'Консультация': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Диагностика': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Терапия': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Профилактика': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Хирургия': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Имплантация': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Ортопедия': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Ортодонтия': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Эстетика': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  'Детская стоматология': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export function AddStandardServicesDialog({
  open,
  onOpenChange,
  clinicId,
  existingServiceNames,
}: AddStandardServicesDialogProps) {
  const queryClient = useQueryClient();
  const existingNamesLower = new Set(existingServiceNames.map(n => n.toLowerCase()));
  
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newSelected = new Set(selectedCategories);
    const newServices = new Set(selectedServices);
    const categoryServices = standardServicesData[category];
    
    if (newSelected.has(category)) {
      newSelected.delete(category);
      categoryServices.forEach(s => {
        if (!existingNamesLower.has(s.name.toLowerCase())) {
          newServices.delete(`${category}:${s.name}`);
        }
      });
    } else {
      newSelected.add(category);
      categoryServices.forEach(s => {
        if (!existingNamesLower.has(s.name.toLowerCase())) {
          newServices.add(`${category}:${s.name}`);
        }
      });
    }
    
    setSelectedCategories(newSelected);
    setSelectedServices(newServices);
  };

  const toggleService = (category: string, serviceName: string) => {
    const key = `${category}:${serviceName}`;
    const newServices = new Set(selectedServices);
    
    if (newServices.has(key)) {
      newServices.delete(key);
    } else {
      newServices.add(key);
    }
    
    setSelectedServices(newServices);
  };

  const addServicesMutation = useMutation({
    mutationFn: async () => {
      const servicesToAdd: Array<{
        name: string;
        category: string;
        duration_minutes: number;
        price: number;
        currency: string;
        clinic_id: string;
        is_active: boolean;
      }> = [];

      selectedServices.forEach(key => {
        const [category, name] = key.split(':');
        const serviceData = standardServicesData[category]?.find(s => s.name === name);
        if (serviceData) {
          servicesToAdd.push({
            name: serviceData.name,
            category,
            duration_minutes: serviceData.duration,
            price: 0,
            currency: 'UZS',
            clinic_id: clinicId,
            is_active: false,
          });
        }
      });

      if (servicesToAdd.length === 0) {
        throw new Error('Выберите услуги для добавления');
      }

      const { error } = await supabase
        .from('services')
        .insert(servicesToAdd);

      if (error) throw error;
      return servicesToAdd.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(`Добавлено ${count} услуг. Установите цены и активируйте их.`);
      onOpenChange(false);
      setSelectedCategories(new Set());
      setSelectedServices(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при добавлении');
    },
  });

  const totalAvailable = Object.entries(standardServicesData).reduce((acc, [_, services]) => {
    return acc + services.filter(s => !existingNamesLower.has(s.name.toLowerCase())).length;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-primary" />
            Добавить стандартные услуги
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Выберите категории или отдельные услуги. После добавления установите цены и активируйте их.
          </p>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {Object.entries(standardServicesData).map(([category, services]) => {
                const availableServices = services.filter(
                  s => !existingNamesLower.has(s.name.toLowerCase())
                );
                
                if (availableServices.length === 0) return null;

                const allSelected = availableServices.every(
                  s => selectedServices.has(`${category}:${s.name}`)
                );
                const someSelected = availableServices.some(
                  s => selectedServices.has(`${category}:${s.name}`)
                );

                return (
                  <div key={category} className="border border-border/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors",
                        allSelected && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={allSelected}
                          ref={(el) => {
                            if (el) (el as HTMLButtonElement).dataset.state = someSelected && !allSelected ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked');
                          }}
                        />
                        <Badge 
                          variant="secondary" 
                          className={cn("font-medium", categoryColors[category])}
                        >
                          {category}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {availableServices.length} услуг
                        </span>
                      </div>
                      {allSelected && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>

                    <div className="border-t border-border/30 divide-y divide-border/30">
                      {availableServices.map((service) => {
                        const isSelected = selectedServices.has(`${category}:${service.name}`);
                        return (
                          <button
                            key={service.name}
                            onClick={() => toggleService(category, service.name)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 pl-10 text-left hover:bg-muted/30 transition-colors",
                              isSelected && "bg-primary/5"
                            )}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1">
                              <span className="text-sm">{service.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {service.duration} мин
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Выбрано: <span className="font-medium text-foreground">{selectedServices.size}</span> из {totalAvailable}
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => addServicesMutation.mutate()}
                disabled={selectedServices.size === 0 || addServicesMutation.isPending}
              >
                {addServicesMutation.isPending ? 'Добавление...' : `Добавить (${selectedServices.size})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
