import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { StaffPageHeader } from "@/components/staff-operations/StaffOperations";
import { PermissionsManager } from "@/components/crm/settings/PermissionsManager";
import { BookingPolicyManager } from "@/components/crm/settings/BookingPolicyManager";
import { WorkingHoursManager } from "@/components/crm/settings/WorkingHoursManager";
import { RoomsManager } from "@/components/crm/settings/RoomsManager";
import { CurrencyManager } from "@/components/crm/settings/CurrencyManager";
import { IntegrationsManager } from "@/components/crm/settings/IntegrationsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClinicAdminSettings() {
  return (
    <ClinicAdminLayout>
      <div className="space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
        <StaffPageHeader
          title="Настройки клиники"
          description="Права сотрудников, правила записи и рабочие кабинеты."
        />
        <Tabs defaultValue="permissions" className="space-y-5">
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-max min-w-full justify-start">
              <TabsTrigger value="permissions">Права</TabsTrigger>
              <TabsTrigger value="booking">Запись</TabsTrigger>
              <TabsTrigger value="rooms">Кабинеты</TabsTrigger>
              <TabsTrigger value="other">Прочее</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="permissions"><PermissionsManager /></TabsContent>
          <TabsContent value="booking" className="space-y-5">
            <BookingPolicyManager />
            <WorkingHoursManager />
          </TabsContent>
          <TabsContent value="rooms"><RoomsManager /></TabsContent>
          <TabsContent value="other" className="space-y-5">
            <CurrencyManager />
            <IntegrationsManager />
          </TabsContent>
        </Tabs>
      </div>
    </ClinicAdminLayout>
  );
}
