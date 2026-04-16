import { CRMLayout } from "@/components/crm/CRMLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield } from "lucide-react";
import { PermissionsManager } from "@/components/crm/settings/PermissionsManager";

export default function CRMSettings() {
  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Настройки</h1>
          <p className="text-muted-foreground mt-1">Настройки CRM</p>
        </div>

        <Tabs defaultValue="permissions" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="permissions" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Shield className="w-4 h-4" />
              Права доступа
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings className="w-4 h-4" />
              Общие
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions">
            <PermissionsManager />
          </TabsContent>

          <TabsContent value="general">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Общие настройки
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-center py-12">
                  Здесь будут общие настройки CRM системы
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
