import { CRMLayout } from "@/components/crm/CRMLayout";
import { DoctorRequestsManager } from "@/components/crm/DoctorRequestsManager";
import { DoctorsList } from "@/components/crm/DoctorsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus } from "lucide-react";
import { useState } from "react";

type PageTab = "doctors" | "requests";

export default function DoctorRequests() {
  const [activeTab, setActiveTab] = useState<PageTab>("doctors");

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Врачи клиники</h1>
          <p className="text-muted-foreground mt-1">Управление врачами и запросами на присоединение</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PageTab)}>
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="doctors" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="w-4 h-4" />
              Врачи
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <UserPlus className="w-4 h-4" />
              Запросы
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctors" className="mt-6">
            <DoctorsList />
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <DoctorRequestsManager />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
