import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function Queue() {
  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Очередь в клинике</h1>
          <p className="text-muted-foreground mt-1">Живая очередь пациентов</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Текущая очередь
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-center py-12">
              Здесь будет живая очередь с реал-тайм обновлениями
            </div>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}
