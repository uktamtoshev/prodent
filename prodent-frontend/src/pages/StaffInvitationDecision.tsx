import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { decideStaffInvitation } from "@/lib/crm-operations-api";

export default function StaffInvitationDecision() {
  const { token = "" } = useParams();
  const { language } = useLanguage();
  const uz = language === "uz";
  const decision = useMutation({
    mutationFn: (value: "accept" | "decline") => decideStaffInvitation(token, value),
  });
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5" />{uz ? "Jamoaga taklif" : "Приглашение в команду"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {decision.isSuccess ? (
            <div className="space-y-3 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p>{uz ? "Javob saqlandi" : "Ответ сохранён"}</p><Button asChild><Link to="/crm">{uz ? "CRM ga o‘tish" : "Перейти в CRM"}</Link></Button></div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{uz ? "Taklifni qabul qiling yoki rad eting." : "Примите приглашение или откажитесь от него."}</p>
              {decision.isError && <p className="text-sm text-destructive">{(decision.error as Error).message}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Button disabled={!token || decision.isPending} onClick={() => decision.mutate("accept")}><CheckCircle2 className="mr-2 h-4 w-4" />{uz ? "Qabul qilish" : "Принять"}</Button>
                <Button variant="outline" disabled={!token || decision.isPending} onClick={() => decision.mutate("decline")}><XCircle className="mr-2 h-4 w-4" />{uz ? "Rad etish" : "Отказаться"}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
