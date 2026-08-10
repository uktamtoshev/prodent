import { useEffect, useState } from "react";
import { Image } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  readWorkspaceBackground,
  writeWorkspaceBackground,
  type WorkspaceBackground,
} from "@/lib/workspace-background";

/**
 * Выбор обоев рабочего пространства кабинета.
 *
 * Тот же переключатель есть в личных настройках врача — это одна и та же
 * настройка, хранится она в одном месте, поэтому изменение в любом из двух
 * экранов сразу видно во втором. Здесь он нужен потому, что пункт меню
 * «Настройки» ведёт именно сюда, и искать оформление пользователь идёт сюда.
 *
 * Значение по умолчанию — «Без фона»: пока его не сменили, кабинет выглядит
 * ровно так же, как до появления этой настройки.
 */
export function WorkspaceBackgroundManager() {
  const { t } = useLanguage();
  // Читаем после монтирования: в тестах и при серверном рендере localStorage
  // может отсутствовать, а расхождение первого рендера даёт мигание.
  const [background, setBackground] = useState<WorkspaceBackground>("none");

  useEffect(() => {
    setBackground(readWorkspaceBackground());
  }, []);

  const handleChange = (value: WorkspaceBackground) => {
    setBackground(value);
    writeWorkspaceBackground(value);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Image className="h-5 w-5 text-primary" />
          {t("crmSettings.workspaceBackground")}
        </CardTitle>
        <CardDescription>{t("crmSettings.workspaceBackgroundDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="crm-workspace-background" className="font-medium">
            {t("crmSettings.workspaceBackground")}
          </Label>
          <Select value={background} onValueChange={handleChange}>
            <SelectTrigger id="crm-workspace-background" className="min-h-11 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("crmSettings.workspaceBackgroundNone")}</SelectItem>
              <SelectItem value="aurora">{t("crmSettings.workspaceBackgroundAurora")}</SelectItem>
              <SelectItem value="sky">{t("crmSettings.workspaceBackgroundSky")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
