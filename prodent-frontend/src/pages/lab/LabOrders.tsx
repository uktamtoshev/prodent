import { FlaskConical } from "lucide-react";
import { LabOrdersCustomer } from "@/components/lab/LabOrdersCustomer";
import { useLanguage } from "@/contexts/LanguageContext";

// Лаборатория › Заказы — the customer order panel (list / create / track / chat),
// now living in the standalone Lab module shell. The clinic-vs-doctor scope is
// enforced server-side by the lab API (/api/v1/lab); this page just renders the
// shared panel that was previously embedded in the CRM/doctor cabinets.
export default function LabOrders() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
          <FlaskConical className="h-6 w-6" />
          {t("labOrdersPage.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("labOrdersPage.subtitle")}
        </p>
      </div>

      <LabOrdersCustomer />
    </div>
  );
}
