import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import {
  bulkCreateClinicServices,
  invalidateClinicServiceQueries,
} from "@/lib/clinic-service-management-api";

interface StandardService {
  nameKey: string;
  categoryKey: string;
  duration_minutes: number;
}

// Internal canonical Russian list — used as DB-backed name when inserting.
const STANDARD_SERVICE_RU: { name: string; category: string; duration_minutes: number; nameKey: string; categoryKey: string }[] = [
  // Консультация
  { name: "Первичная консультация", category: "Консультация", duration_minutes: 30, nameKey: "svcFirstConsultation", categoryKey: "catConsultation" },
  { name: "Повторная консультация", category: "Консультация", duration_minutes: 20, nameKey: "svcRepeatConsultation", categoryKey: "catConsultation" },
  { name: "Консультация ортодонта", category: "Консультация", duration_minutes: 45, nameKey: "svcOrthodontConsultation", categoryKey: "catConsultation" },
  { name: "Консультация хирурга", category: "Консультация", duration_minutes: 30, nameKey: "svcSurgeonConsultation", categoryKey: "catConsultation" },
  { name: "Консультация имплантолога", category: "Консультация", duration_minutes: 45, nameKey: "svcImplantologistConsultation", categoryKey: "catConsultation" },

  // Диагностика
  { name: "Панорамный снимок (ОПТГ)", category: "Диагностика", duration_minutes: 15, nameKey: "svcPanoramicXray", categoryKey: "catDiagnostics" },
  { name: "Прицельный рентген-снимок", category: "Диагностика", duration_minutes: 10, nameKey: "svcTargetedXray", categoryKey: "catDiagnostics" },
  { name: "Компьютерная томография (КТ)", category: "Диагностика", duration_minutes: 20, nameKey: "svcCTScan", categoryKey: "catDiagnostics" },
  { name: "3D сканирование зубов", category: "Диагностика", duration_minutes: 30, nameKey: "svc3DScan", categoryKey: "catDiagnostics" },

  // Терапия
  { name: "Лечение кариеса", category: "Терапия", duration_minutes: 45, nameKey: "svcCariesTreatment", categoryKey: "catTherapy" },
  { name: "Лечение пульпита", category: "Терапия", duration_minutes: 60, nameKey: "svcPulpitisTreatment", categoryKey: "catTherapy" },
  { name: "Лечение периодонтита", category: "Терапия", duration_minutes: 60, nameKey: "svcPeriodontitisTreatment", categoryKey: "catTherapy" },
  { name: "Пломба светоотверждаемая", category: "Терапия", duration_minutes: 40, nameKey: "svcLightFilling", categoryKey: "catTherapy" },
  { name: "Реставрация зуба", category: "Терапия", duration_minutes: 60, nameKey: "svcRestoration", categoryKey: "catTherapy" },
  { name: "Эндодонтическое лечение (1 канал)", category: "Терапия", duration_minutes: 45, nameKey: "svcEndo1", categoryKey: "catTherapy" },
  { name: "Эндодонтическое лечение (2 канала)", category: "Терапия", duration_minutes: 60, nameKey: "svcEndo2", categoryKey: "catTherapy" },
  { name: "Эндодонтическое лечение (3+ каналов)", category: "Терапия", duration_minutes: 90, nameKey: "svcEndo3", categoryKey: "catTherapy" },

  // Профилактика
  { name: "Профессиональная чистка зубов", category: "Профилактика", duration_minutes: 60, nameKey: "svcProfessionalCleaning", categoryKey: "catPrevention" },
  { name: "Ультразвуковая чистка", category: "Профилактика", duration_minutes: 45, nameKey: "svcUltrasonicCleaning", categoryKey: "catPrevention" },
  { name: "Air Flow", category: "Профилактика", duration_minutes: 40, nameKey: "svcAirFlow", categoryKey: "catPrevention" },
  { name: "Фторирование зубов", category: "Профилактика", duration_minutes: 30, nameKey: "svcFluoridation", categoryKey: "catPrevention" },
  { name: "Герметизация фиссур", category: "Профилактика", duration_minutes: 30, nameKey: "svcFissureSealing", categoryKey: "catPrevention" },

  // Хирургия
  { name: "Удаление зуба простое", category: "Хирургия", duration_minutes: 30, nameKey: "svcSimpleExtraction", categoryKey: "catSurgery" },
  { name: "Удаление зуба сложное", category: "Хирургия", duration_minutes: 60, nameKey: "svcComplexExtraction", categoryKey: "catSurgery" },
  { name: "Удаление зуба мудрости", category: "Хирургия", duration_minutes: 90, nameKey: "svcWisdomToothExtraction", categoryKey: "catSurgery" },
  { name: "Резекция верхушки корня", category: "Хирургия", duration_minutes: 60, nameKey: "svcRootApex", categoryKey: "catSurgery" },
  { name: "Пластика уздечки губы", category: "Хирургия", duration_minutes: 30, nameKey: "svcLipFrenulum", categoryKey: "catSurgery" },
  { name: "Пластика уздечки языка", category: "Хирургия", duration_minutes: 30, nameKey: "svcTongueFrenulum", categoryKey: "catSurgery" },
  { name: "Синус-лифтинг закрытый", category: "Хирургия", duration_minutes: 90, nameKey: "svcSinusLiftClosed", categoryKey: "catSurgery" },
  { name: "Синус-лифтинг открытый", category: "Хирургия", duration_minutes: 120, nameKey: "svcSinusLiftOpen", categoryKey: "catSurgery" },

  // Имплантация
  { name: "Имплантация (1 имплант)", category: "Имплантация", duration_minutes: 60, nameKey: "svcImplant", categoryKey: "catImplantation" },
  { name: "Установка формирователя десны", category: "Имплантация", duration_minutes: 30, nameKey: "svcGumFormer", categoryKey: "catImplantation" },
  { name: "Костная пластика", category: "Имплантация", duration_minutes: 90, nameKey: "svcBoneGraft", categoryKey: "catImplantation" },
  { name: "Установка абатмента", category: "Имплантация", duration_minutes: 30, nameKey: "svcAbutment", categoryKey: "catImplantation" },

  // Ортопедия
  { name: "Металлокерамическая коронка", category: "Ортопедия", duration_minutes: 45, nameKey: "svcMetalCeramicCrown", categoryKey: "catProsthetics" },
  { name: "Циркониевая коронка", category: "Ортопедия", duration_minutes: 45, nameKey: "svcZirconiaCrown", categoryKey: "catProsthetics" },
  { name: "Керамическая коронка E-max", category: "Ортопедия", duration_minutes: 45, nameKey: "svcEmaxCrown", categoryKey: "catProsthetics" },
  { name: "Временная коронка", category: "Ортопедия", duration_minutes: 30, nameKey: "svcTempCrown", categoryKey: "catProsthetics" },
  { name: "Винир керамический", category: "Ортопедия", duration_minutes: 60, nameKey: "svcVeneer", categoryKey: "catProsthetics" },
  { name: "Мостовидный протез (1 единица)", category: "Ортопедия", duration_minutes: 45, nameKey: "svcBridge", categoryKey: "catProsthetics" },
  { name: "Съёмный протез частичный", category: "Ортопедия", duration_minutes: 60, nameKey: "svcRemovablePartial", categoryKey: "catProsthetics" },
  { name: "Съёмный протез полный", category: "Ортопедия", duration_minutes: 60, nameKey: "svcRemovableFull", categoryKey: "catProsthetics" },
  { name: "Бюгельный протез", category: "Ортопедия", duration_minutes: 60, nameKey: "svcBugel", categoryKey: "catProsthetics" },
  { name: "Вкладка культевая", category: "Ортопедия", duration_minutes: 40, nameKey: "svcStumpInlay", categoryKey: "catProsthetics" },

  // Ортодонтия
  { name: "Установка брекет-системы (металлическая)", category: "Ортодонтия", duration_minutes: 120, nameKey: "svcMetalBraces", categoryKey: "catOrthodontics" },
  { name: "Установка брекет-системы (керамическая)", category: "Ортодонтия", duration_minutes: 120, nameKey: "svcCeramicBraces", categoryKey: "catOrthodontics" },
  { name: "Установка брекет-системы (сапфировая)", category: "Ортодонтия", duration_minutes: 120, nameKey: "svcSapphireBraces", categoryKey: "catOrthodontics" },
  { name: "Элайнеры (полный курс)", category: "Ортодонтия", duration_minutes: 60, nameKey: "svcAligners", categoryKey: "catOrthodontics" },
  { name: "Активация брекет-системы", category: "Ортодонтия", duration_minutes: 45, nameKey: "svcBracesActivation", categoryKey: "catOrthodontics" },
  { name: "Снятие брекет-системы", category: "Ортодонтия", duration_minutes: 60, nameKey: "svcBracesRemoval", categoryKey: "catOrthodontics" },
  { name: "Ретейнер несъёмный", category: "Ортодонтия", duration_minutes: 45, nameKey: "svcRetainer", categoryKey: "catOrthodontics" },

  // Эстетика
  { name: "Отбеливание зубов (кабинетное)", category: "Эстетика", duration_minutes: 90, nameKey: "svcOfficeBleach", categoryKey: "catAesthetics" },
  { name: "Отбеливание зубов (домашнее)", category: "Эстетика", duration_minutes: 30, nameKey: "svcHomeBleach", categoryKey: "catAesthetics" },
  { name: "Художественная реставрация", category: "Эстетика", duration_minutes: 90, nameKey: "svcArtRestoration", categoryKey: "catAesthetics" },
  { name: "Украшение зуба (скайс)", category: "Эстетика", duration_minutes: 20, nameKey: "svcSkyce", categoryKey: "catAesthetics" },

  // Детская стоматология
  { name: "Лечение молочного зуба", category: "Детская стоматология", duration_minutes: 30, nameKey: "svcMilkToothTreatment", categoryKey: "catPediatric" },
  { name: "Удаление молочного зуба", category: "Детская стоматология", duration_minutes: 20, nameKey: "svcMilkToothExtraction", categoryKey: "catPediatric" },
  { name: "Серебрение зубов", category: "Детская стоматология", duration_minutes: 20, nameKey: "svcSilvering", categoryKey: "catPediatric" },
  { name: "Герметизация фиссур (детская)", category: "Детская стоматология", duration_minutes: 25, nameKey: "svcChildFissureSealing", categoryKey: "catPediatric" },
  { name: "Пломба на молочный зуб", category: "Детская стоматология", duration_minutes: 30, nameKey: "svcMilkToothFilling", categoryKey: "catPediatric" },
];

// Public re-export — kept for back-compat with imports elsewhere.
export const STANDARD_SERVICES = STANDARD_SERVICE_RU.map((s) => ({
  name: s.name,
  category: s.category,
  duration_minutes: s.duration_minutes,
}));

interface AddStandardServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  existingNames: string[];
}

export function AddStandardServicesDialog({
  open,
  onOpenChange,
  clinicId,
  existingNames,
}: AddStandardServicesDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { canEdit } = useModulePermissions();

  const existingSet = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase())),
    [existingNames],
  );

  // Group localized version while preserving Russian for DB insert.
  const grouped = useMemo(() => {
    const out: Record<string, typeof STANDARD_SERVICE_RU> = {};
    STANDARD_SERVICE_RU.forEach((s) => {
      if (existingSet.has(s.name.toLowerCase())) return;
      const localCat = t(`crmServiceDialogs.${s.categoryKey}`);
      (out[localCat] ||= []).push(s);
    });
    return out;
  }, [existingSet, t]);

  const allCategories = Object.keys(grouped);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    new Set(allCategories),
  );

  // Recompute when grouped changes (e.g. after open)
  useMemo(() => {
    setSelectedCats(new Set(allCategories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories.join("|")]);

  const toggleCat = (cat: string) =>
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const selectAll = () => setSelectedCats(new Set(allCategories));
  const selectNone = () => setSelectedCats(new Set());

  const itemsToAdd = useMemo(
    () =>
      allCategories
        .filter((c) => selectedCats.has(c))
        .flatMap((c) => grouped[c]),
    [allCategories, selectedCats, grouped],
  );

  const totalAvailable = STANDARD_SERVICE_RU.length - existingSet.size;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit("services")) throw new Error(t('crm.accessDenied'));
      let cid = clinicId;
      if (!cid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: doctor } = await supabase
            .from("doctors")
            .select("clinic_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (doctor?.clinic_id) cid = doctor.clinic_id;
        }
      }
      if (!cid) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      if (itemsToAdd.length === 0) throw new Error(t('crmServiceDialogs.noServicesSelected'));

      const rows = itemsToAdd.map((s) => ({
        nameRu: s.name,
        category: s.category,
        duration: s.duration_minutes,
        price: 0,
        currency: "UZS" as const,
        isActive: false, // inactive until clinic sets a price
      }));

      return (await bulkCreateClinicServices(cid, rows)).length;
    },
    onSuccess: (count) => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(
        `${t('crmServiceDialogs.addedServices')} ${count} ${t('crmServiceDialogs.setPricesAndActivate')}`,
      );
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error(e.message || t('crmServiceDialogs.addError'));
    },
  });

  // Russian-style plural for ru only — for other locales we just use plural form.
  const pluralServiceWord = (n: number) => {
    if (n === 1) return t('crmServiceDialogs.service1');
    if (n < 5) return t('crmServiceDialogs.service24');
    return t('crmServiceDialogs.service5plus');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t('crmServiceDialogs.addStandardServices')}
          </DialogTitle>
          <DialogDescription>
            {t('crmServiceDialogs.standardServicesDescription')}
          </DialogDescription>
        </DialogHeader>

        {totalAvailable === 0 ? (
          <div className="px-1 py-8 text-center">
            <ListPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="font-heading text-base font-semibold text-foreground">
              {t('crmServiceDialogs.allStandardAdded')}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t('crmServiceDialogs.createOwnHint')}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                {t('crmServiceDialogs.availableToAdd')}:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {totalAvailable}
                </span>
                {" · "}{t('crmServiceDialogs.selected')}{" "}
                <span className="font-semibold tabular-nums text-primary">
                  {itemsToAdd.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  {t('crmServiceDialogs.selectAll')}
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {t('crmServiceDialogs.deselectAll')}
                </button>
              </div>
            </div>

            <ScrollArea className="h-[360px] rounded-md border border-border">
              <div className="divide-y divide-border">
                {allCategories.map((cat) => {
                  const items = grouped[cat];
                  const checked = selectedCats.has(cat);
                  return (
                    <div key={cat} className="px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCat(cat)}
                        />
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span className="font-heading text-base font-semibold text-foreground">
                          {cat}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {items.length}
                        </span>
                      </label>
                      <ul className="mt-2 ml-8 space-y-0.5 text-xs text-muted-foreground">
                        {items.map((s) => (
                          <li key={s.name} className="flex items-center gap-2">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                            <span>{t(`crmServiceDialogs.${s.nameKey}`)}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {s.duration_minutes} {t('crmServiceDialogs.minutesShort')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          {totalAvailable > 0 && (
            <Button
              onClick={() => addMutation.mutate()}
              disabled={
                itemsToAdd.length === 0 || addMutation.isPending || !clinicId
              }
            >
              {addMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('crmServiceDialogs.addServicesCount')} {itemsToAdd.length}{" "}
              {pluralServiceWord(itemsToAdd.length)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
