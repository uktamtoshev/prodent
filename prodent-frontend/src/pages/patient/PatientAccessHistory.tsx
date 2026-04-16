import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, CheckCircle, XCircle, History, Loader2 } from "lucide-react";
import { usePatientAccessRequests } from "@/hooks/useMedicalAccess";
import { AccessRequestCard } from "@/components/medical/AccessRequestCard";

export default function PatientAccessHistory() {
  const { data: requests, isLoading } = usePatientAccessRequests();

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const activeRequests = requests?.filter(r => r.status === 'active') || [];
  const historyRequests = requests?.filter(r => ['expired', 'revoked'].includes(r.status)) || [];

  if (isLoading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-tashkent-sky shadow-medium">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-foreground">Доступ к медкарте</h1>
            <p className="text-muted-foreground mt-1">
              Управление запросами на доступ к вашим медицинским данным
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
                  <p className="text-sm text-muted-foreground">Ожидают решения</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{activeRequests.length}</p>
                  <p className="text-sm text-muted-foreground">Активные доступы</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{historyRequests.length}</p>
                  <p className="text-sm text-muted-foreground">В истории</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Ожидающие
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Активные
              {activeRequests.length > 0 && (
                <Badge className="ml-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {activeRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Нет ожидающих запросов</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <AccessRequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Нет активных доступов</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Когда вы одобрите запрос, он появится здесь
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeRequests.map((request) => (
                <AccessRequestCard key={request.id} request={request} />
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {historyRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">История пуста</p>
                </CardContent>
              </Card>
            ) : (
              historyRequests.map((request) => (
                <AccessRequestCard key={request.id} request={request} showActions={false} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
}
