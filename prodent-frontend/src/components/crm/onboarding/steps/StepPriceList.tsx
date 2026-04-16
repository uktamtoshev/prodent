import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListChecks, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DEFAULT_SERVICES = [
  { category: "Диагностика", services: ["Первичный осмотр", "Рентгенография", "КТ (КЛКТ)", "Панорамный снимок"] },
  { category: "Терапия", services: ["Лечение кариеса", "Лечение пульпита", "Пломбирование", "Чистка каналов"] },
  { category: "Хирургия", services: ["Удаление зуба простое", "Удаление зуба сложное", "Удаление зуба мудрости", "Имплантация"] },
  { category: "Ортодонтия", services: ["Брекеты металлические", "Брекеты керамические", "Элайнеры", "Ретейнеры"] },
  { category: "Гигиена", services: ["Профессиональная чистка", "Air Flow", "Фторирование", "Отбеливание"] },
  { category: "Протезирование", services: ["Коронка металлокерамика", "Коронка циркониевая", "Виниры", "Мост"] },
];

interface StepPriceListProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepPriceList({ onNext, onBack, onSkip }: StepPriceListProps) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleService = (service: string) => {
    const next = new Set(selected);
    if (next.has(service)) next.delete(service);
    else next.add(service);
    setSelected(next);
  };

  const selectAll = () => {
    const all = new Set<string>();
    DEFAULT_SERVICES.forEach((cat) => cat.services.forEach((s) => all.add(s)));
    setSelected(all);
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      onSkip();
      return;
    }
    setLoading(true);
    try {
      if (!currentClinic?.id) throw new Error("No clinic");

      const services = Array.from(selected).map((name) => {
        const category = DEFAULT_SERVICES.find((c) => c.services.includes(name))?.category || "Другое";
        return {
          name,
          category,
          clinic_id: currentClinic.id,
          price: 0,
          currency: "сум",
          is_active: true,
        };
      });

      const { error } = await supabase.from("services").insert(services);
      if (error) throw error;

      toast({ title: `${selected.size} услуг добавлено ✓` });
      onNext();
    } catch {
      toast({ title: "Ошибка добавления услуг", variant: "destructive" });
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
        <CardTitle className="text-xl">Настройте прайс-лист</CardTitle>
        <CardDescription>
          Выберите услуги для быстрого старта. Цены можно настроить позже.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <Badge variant="outline">{selected.size} выбрано</Badge>
          <Button variant="ghost" size="sm" onClick={selectAll}>Выбрать все</Button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
          {DEFAULT_SERVICES.map((cat) => (
            <div key={cat.category}>
              <h4 className="text-sm font-medium text-foreground mb-2">{cat.category}</h4>
              <div className="flex flex-wrap gap-2">
                {cat.services.map((service) => {
                  const isSelected = selected.has(service);
                  return (
                    <button
                      key={service}
                      onClick={() => toggleService(service)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      {service}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1">Назад</Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1">Пропустить</Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Добавить ({selected.size})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
