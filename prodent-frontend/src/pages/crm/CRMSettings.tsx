import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Shield } from "lucide-react";
import { PermissionsManager } from "@/components/crm/settings/PermissionsManager";
import { BookingPolicyManager } from "@/components/crm/settings/BookingPolicyManager";
import { CurrencyManager } from "@/components/crm/settings/CurrencyManager";
import { IntegrationsManager } from "@/components/crm/settings/IntegrationsManager";
import { RoomsManager } from "@/components/crm/settings/RoomsManager";
import { WorkingHoursManager } from "@/components/crm/settings/WorkingHoursManager";
import { WorkspaceBackgroundManager } from "@/components/crm/settings/WorkspaceBackgroundManager";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CRMSettings() {
  const { t } = useLanguage();
  return (
    <CRMLayout>
      <div className="space-y-section p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmSettings.title")}</h1>
            <p className="text-muted-foreground">{t("crmSettings.description")}</p>
          </div>
        </div>

        <Tabs defaultValue="permissions" className="space-y-section">
          <TabsList className="h-auto flex-wrap gap-0.5">
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="w-4 h-4" />
              {t("crmSettings.tabPermissions")}
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Settings className="w-4 h-4" />
              {t("crmSettings.tabGeneral")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions">
            <PermissionsManager />
          </TabsContent>

          <TabsContent value="general">
            <div className="space-y-section">
              <WorkspaceBackgroundManager />
              <BookingPolicyManager />
              <WorkingHoursManager />
              <RoomsManager />
              <CurrencyManager />
              <IntegrationsManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
