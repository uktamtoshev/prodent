import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ListPlus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  bulkCreateClinicServices,
  invalidateClinicServiceQueries,
} from '@/lib/clinic-service-management-api';

interface AddStandardServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  existingServiceNames: string[];
}

// Standard dental services organized by category. Names are stored in Russian for DB
// inserts; UI presents localized labels via crmServiceDialogs.* keys.
const standardServicesData: Record<string, Array<{ name: string; duration: number; nameKey: string }>> = {
  'Консультация': [
    { name: 'Первичная консультация', duration: 30, nameKey: 'svcFirstConsultation' },
    { name: 'Повторная консультация', duration: 20, nameKey: 'svcRepeatConsultation' },
    { name: 'Консультация ортодонта', duration: 45, nameKey: 'svcOrthodontConsultation' },
    { name: 'Консультация хирурга', duration: 30, nameKey: 'svcSurgeonConsultation' },
    { name: 'Консультация имплантолога', duration: 45, nameKey: 'svcImplantologistConsultation' },
  ],
  'Диагностика': [
    { name: 'Панорамный снимок (ОПТГ)', duration: 15, nameKey: 'svcPanoramicXray' },
    { name: 'Прицельный рентген-снимок', duration: 10, nameKey: 'svcTargetedXray' },
    { name: 'Компьютерная томография (КТ)', duration: 20, nameKey: 'svcCTScan' },
    { name: '3D сканирование зубов', duration: 30, nameKey: 'svc3DScan' },
  ],
  'Терапия': [
    { name: 'Лечение кариеса', duration: 45, nameKey: 'svcCariesTreatment' },
    { name: 'Лечение пульпита', duration: 60, nameKey: 'svcPulpitisTreatment' },
    { name: 'Лечение периодонтита', duration: 60, nameKey: 'svcPeriodontitisTreatment' },
    { name: 'Пломба светоотверждаемая', duration: 40, nameKey: 'svcLightFilling' },
    { name: 'Реставрация зуба', duration: 60, nameKey: 'svcRestoration' },
    { name: 'Эндодонтическое лечение (1 канал)', duration: 45, nameKey: 'svcEndo1' },
    { name: 'Эндодонтическое лечение (2 канала)', duration: 60, nameKey: 'svcEndo2' },
    { name: 'Эндодонтическое лечение (3+ каналов)', duration: 90, nameKey: 'svcEndo3' },
  ],
  'Профилактика': [
    { name: 'Профессиональная чистка зубов', duration: 60, nameKey: 'svcProfessionalCleaning' },
    { name: 'Ультразвуковая чистка', duration: 45, nameKey: 'svcUltrasonicCleaning' },
    { name: 'Air Flow', duration: 40, nameKey: 'svcAirFlow' },
    { name: 'Фторирование зубов', duration: 30, nameKey: 'svcFluoridation' },
    { name: 'Герметизация фиссур', duration: 30, nameKey: 'svcFissureSealing' },
  ],
  'Хирургия': [
    { name: 'Удаление зуба простое', duration: 30, nameKey: 'svcSimpleExtraction' },
    { name: 'Удаление зуба сложное', duration: 60, nameKey: 'svcComplexExtraction' },
    { name: 'Удаление зуба мудрости', duration: 90, nameKey: 'svcWisdomToothExtraction' },
    { name: 'Резекция верхушки корня', duration: 60, nameKey: 'svcRootApex' },
    { name: 'Пластика уздечки губы', duration: 30, nameKey: 'svcLipFrenulum' },
    { name: 'Синус-лифтинг закрытый', duration: 90, nameKey: 'svcSinusLiftClosed' },
    { name: 'Синус-лифтинг открытый', duration: 120, nameKey: 'svcSinusLiftOpen' },
  ],
  'Имплантация': [
    { name: 'Имплантация (1 имплант)', duration: 60, nameKey: 'svcImplant' },
    { name: 'Установка формирователя десны', duration: 30, nameKey: 'svcGumFormer' },
    { name: 'Костная пластика', duration: 90, nameKey: 'svcBoneGraft' },
    { name: 'Установка абатмента', duration: 30, nameKey: 'svcAbutment' },
  ],
  'Ортопедия': [
    { name: 'Металлокерамическая коронка', duration: 45, nameKey: 'svcMetalCeramicCrown' },
    { name: 'Циркониевая коронка', duration: 45, nameKey: 'svcZirconiaCrown' },
    { name: 'Керамическая коронка E-max', duration: 45, nameKey: 'svcEmaxCrown' },
    { name: 'Временная коронка', duration: 30, nameKey: 'svcTempCrown' },
    { name: 'Винир керамический', duration: 60, nameKey: 'svcVeneer' },
    { name: 'Мостовидный протез (1 единица)', duration: 45, nameKey: 'svcBridge' },
    { name: 'Съёмный протез частичный', duration: 60, nameKey: 'svcRemovablePartial' },
    { name: 'Съёмный протез полный', duration: 60, nameKey: 'svcRemovableFull' },
  ],
  'Ортодонтия': [
    { name: 'Установка брекет-системы (металлическая)', duration: 120, nameKey: 'svcMetalBraces' },
    { name: 'Установка брекет-системы (керамическая)', duration: 120, nameKey: 'svcCeramicBraces' },
    { name: 'Элайнеры (полный курс)', duration: 60, nameKey: 'svcAligners' },
    { name: 'Активация брекет-системы', duration: 45, nameKey: 'svcBracesActivation' },
    { name: 'Снятие брекет-системы', duration: 60, nameKey: 'svcBracesRemoval' },
    { name: 'Ретейнер несъёмный', duration: 45, nameKey: 'svcRetainer' },
  ],
  'Эстетика': [
    { name: 'Отбеливание зубов (кабинетное)', duration: 90, nameKey: 'svcOfficeBleach' },
    { name: 'Отбеливание зубов (домашнее)', duration: 30, nameKey: 'svcHomeBleach' },
    { name: 'Художественная реставрация', duration: 90, nameKey: 'svcArtRestoration' },
  ],
  'Детская стоматология': [
    { name: 'Лечение молочного зуба', duration: 30, nameKey: 'svcMilkToothTreatment' },
    { name: 'Удаление молочного зуба', duration: 20, nameKey: 'svcMilkToothExtraction' },
    { name: 'Серебрение зубов', duration: 20, nameKey: 'svcSilvering' },
    { name: 'Пломба на молочный зуб', duration: 30, nameKey: 'svcMilkToothFilling' },
  ],
};

const categoryKeyMap: Record<string, string> = {
  'Консультация': 'catConsultation',
  'Диагностика': 'catDiagnostics',
  'Терапия': 'catTherapy',
  'Профилактика': 'catPrevention',
  'Хирургия': 'catSurgery',
  'Имплантация': 'catImplantation',
  'Ортопедия': 'catProsthetics',
  'Ортодонтия': 'catOrthodontics',
  'Эстетика': 'catAesthetics',
  'Детская стоматология': 'catPediatric',
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
  const { t } = useLanguage();
  const { canEdit } = useModulePermissions();
  const existingNamesLower = new Set(
    existingServiceNames.filter(Boolean).map((n) => n.toLowerCase()),
  );

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newSelected = new Set(selectedCategories);
    const newServices = new Set(selectedServices);
    const categoryServices = standardServicesData[category];

    if (newSelected.has(category)) {
      newSelected.delete(category);
      categoryServices.forEach(s => {
        if (!existingNamesLower.has((s.name ?? '').toLowerCase())) {
          newServices.delete(`${category}:${s.name}`);
        }
      });
    } else {
      newSelected.add(category);
      categoryServices.forEach(s => {
        if (!existingNamesLower.has((s.name ?? '').toLowerCase())) {
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
      if (!canEdit('services')) throw new Error(t('crm.accessDenied'));
      const servicesToAdd: Array<{
        nameRu: string;
        category: string;
        duration: number;
        price: number;
        currency: 'UZS';
        isActive: boolean;
      }> = [];

      selectedServices.forEach(key => {
        const [category, name] = key.split(':');
        const serviceData = standardServicesData[category]?.find(s => s.name === name);
        if (serviceData) {
          servicesToAdd.push({
            nameRu: serviceData.name,
            category,
            duration: serviceData.duration,
            price: 0,
            currency: 'UZS',
            isActive: false,
          });
        }
      });

      if (servicesToAdd.length === 0) {
        throw new Error(t('crmServiceDialogs.noServicesSelected'));
      }

      return (await bulkCreateClinicServices(clinicId, servicesToAdd)).length;
    },
    onSuccess: (count) => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(`${t('crmServiceDialogs.addedServices')} ${count} ${t('crmServiceDialogs.setPricesAndActivate')}`);
      onOpenChange(false);
      setSelectedCategories(new Set());
      setSelectedServices(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message || t('crmServiceDialogs.addError'));
    },
  });

  const totalAvailable = Object.entries(standardServicesData).reduce((acc, [_, services]) => {
    return acc + services.filter(s => !existingNamesLower.has((s.name ?? '').toLowerCase())).length;
  }, 0);

  const pluralServiceWord = (n: number) => {
    if (n === 1) return t('crmServiceDialogs.service1');
    if (n < 5) return t('crmServiceDialogs.service24');
    return t('crmServiceDialogs.service5plus');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-primary" />
            {t('crmServiceDialogs.addStandardServices')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('crmServiceDialogs.standardServicesDescription')}
          </p>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {Object.entries(standardServicesData).map(([category, services]) => {
                const availableServices = services.filter(
                  s => !existingNamesLower.has((s.name ?? '').toLowerCase())
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
                          {t(`crmServiceDialogs.${categoryKeyMap[category]}`)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {availableServices.length} {pluralServiceWord(availableServices.length)}
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
                              <span className="text-sm">{t(`crmServiceDialogs.${service.nameKey}`)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {service.duration} {t('crmServiceDialogs.minutesShort')}
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
              {t('crmServiceDialogs.selectedFromTotal')}: <span className="font-medium text-foreground">{selectedServices.size}</span> {t('crmServiceDialogs.ofTotal')} {totalAvailable}
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => addServicesMutation.mutate()}
                disabled={selectedServices.size === 0 || addServicesMutation.isPending}
              >
                {addServicesMutation.isPending ? t('common.loading') : `${t('crmServiceDialogs.addServicesCount')} (${selectedServices.size})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
