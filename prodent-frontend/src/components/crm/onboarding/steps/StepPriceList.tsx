import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useClinic } from "@/contexts/ClinicContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListChecks, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import {
  bulkCreateClinicServices,
  invalidateClinicServiceQueries,
} from "@/lib/clinic-service-management-api";
import {
  buildOnboardingServiceInputs,
  localizeOnboardingServiceCatalog,
} from "@/lib/onboarding-service-catalog";

interface StepPriceListProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepPriceList({ onNext, onBack, onSkip }: StepPriceListProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit } = useModulePermissions();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const defaultServices = useMemo(() => localizeOnboardingServiceCatalog(t), [t]);

  const toggleService = (service: string) => {
    const next = new Set(selected);
    if (next.has(service)) next.delete(service);
    else next.add(service);
    setSelected(next);
  };

  const selectAll = () => {
    const all = new Set<string>();
    defaultServices.forEach((cat) => cat.services.forEach((service) => all.add(service.nameRu)));
    setSelected(all);
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      onSkip();
      return;
    }
    setLoading(true);
    try {
      if (!canEdit("services")) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error("No clinic");

      const services = buildOnboardingServiceInputs(selected);
      const inserted = (await bulkCreateClinicServices(currentClinic.id, services)).length;
      await invalidateClinicServiceQueries(queryClient);

      toast({ title: `${inserted} ${t('crmStepPriceList.servicesAdded')}` });
      onNext();
    } catch (e) {
      console.error("StepPriceList save error:", e);
      toast({ title: t('crmStepPriceList.addError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <ListChecks className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">{t('crmStepPriceList.configurePriceList')}</CardTitle>
        <CardDescription>
          {t('crmStepPriceList.selectStartServices')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Badge variant="outline">{selected.size} {t('crmStepPriceList.selectedCount')}</Badge>
          <Button variant="ghost" size="sm" onClick={selectAll}>{t('crmStepPriceList.selectAll')}</Button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
          {defaultServices.map((cat) => (
            <div key={cat.categoryRu}>
              <h4 className="text-sm font-medium text-foreground mb-2">{cat.label}</h4>
              <div className="flex flex-wrap gap-2">
                {cat.services.map((service) => {
                  const isSelected = selected.has(service.nameRu);
                  return (
                    <button
                      key={service.nameRu}
                      onClick={() => toggleService(service.nameRu)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      {service.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1">{t('crmStepPriceList.back')}</Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1">{t('crmStepPriceList.skip')}</Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('crmStepPriceList.addCount')} ({selected.size})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
