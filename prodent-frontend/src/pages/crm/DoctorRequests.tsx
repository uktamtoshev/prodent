import { CRMLayout } from "@/components/crm/CRMLayout";
import { DoctorRequestsManager } from "@/components/crm/DoctorRequestsManager";
import { DoctorsList } from "@/components/crm/DoctorsList";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

type PageTab = "doctors" | "requests";

export default function DoctorRequests() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<PageTab>("doctors");

  return (
    <CRMLayout>
      <div className="space-y-section p-4 pb-24 lg:p-6">
        {/* Заголовок без декоративной иконки — в макете её нет. Бейдж под
            заголовком тоже убран: он дублировал имя активной вкладки, которая
            видна строкой ниже. */}
        <div>
          <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmDoctorRequests.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("crmDoctorRequests.description")}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PageTab)} className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0.5 sm:w-fit">
            <TabsTrigger value="doctors" className="gap-2 rounded-lg px-4 py-2">
              <Users className="h-4 w-4" />
              {t("crmDoctorRequests.tabDoctors")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2 rounded-lg px-4 py-2">
              <UserPlus className="h-4 w-4" />
              {t("crmDoctorRequests.tabRequests")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctors" className="mt-0">
            <DoctorsList />
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <DoctorRequestsManager />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
