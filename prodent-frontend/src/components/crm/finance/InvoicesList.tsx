import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

// NOTE (pilot): the `invoices` and `payments` tables are intentionally NOT
// exposed through the /api/v1/data proxy (they are excluded from ALLOWED_TABLES
// in the backend). The previous implementation queried them via the Supabase
// shim, which swallows the resulting 403 and rendered a permanently-empty list
// plus a "create invoice"/"add payment" flow that silently saved nothing.
//
// Until a dedicated finance endpoint exists, show an honest "module unavailable"
// state instead of pretending the feature works.
export function InvoicesList() {
  return (
    <Card className="bg-card/80 border-border/50">
      <CardContent className="py-16 text-center">
        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-base font-medium text-foreground">
          Модуль счетов недоступен в пилоте
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Выставление счетов и приём платежей появятся после подключения
          финансового модуля.
        </p>
      </CardContent>
    </Card>
  );
}
