import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  X, Calendar, User, FileText, Camera, Package, Lightbulb, 
  History, ChevronRight, Layers, Activity, Image
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ToothSurfacesDiagram } from "./ToothSurfacesDiagram";
import { ToothTimeline } from "./ToothTimeline";
import { ToothRiskIndicator } from "./ToothRiskIndicator";
import { ToothAttachmentsGallery } from "./ToothAttachmentsGallery";
import { QuickProcedureMenu } from "./QuickProcedureMenu";

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const STATUS_CONFIG: Record<ToothStatus, { label: string; color: string; bgClass: string }> = {
  healthy: { label: 'Здоровый', color: '#10B981', bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  caries: { label: 'Кариес', color: '#F59E0B', bgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  filling: { label: 'Пломба', color: '#3B82F6', bgClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  crown: { label: 'Коронка', color: '#EAB308', bgClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  implant: { label: 'Имплант', color: '#64748B', bgClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
  removed: { label: 'Удалён', color: '#9CA3AF', bgClass: 'bg-gray-500/10 text-gray-500 border-gray-500/30' },
  watch: { label: 'Наблюдение', color: '#F97316', bgClass: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  endo: { label: 'Эндодонтия', color: '#EF4444', bgClass: 'bg-red-500/10 text-red-600 border-red-500/30' },
  periodontitis: { label: 'Периодонтит', color: '#DC2626', bgClass: 'bg-red-600/10 text-red-700 border-red-600/30' },
};

interface ToothData {
  id?: string;
  tooth_number: number;
  status: ToothStatus;
  notes?: string | null;
  images?: string[] | null;
  before_image?: string | null;
  after_image?: string | null;
  materials?: string | null;
  recommendations?: string | null;
  doctor_name?: string | null;
  updated_at?: string | null;
  procedures?: Array<{
    date: string;
    name: string;
    doctor: string;
    price?: number;
  }>;
}

interface SmartToothDetailCardProps {
  tooth: ToothData;
  patientId: string;
  isChild?: boolean;
  readOnly?: boolean;
  doctorId?: string;
  onClose: () => void;
  onAddToPlan?: (toothNumber: number) => void;
}

export function SmartToothDetailCard({ 
  tooth, 
  patientId,
  isChild = false, 
  readOnly = true,
  doctorId,
  onClose,
  onAddToPlan
}: SmartToothDetailCardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const config = STATUS_CONFIG[tooth.status] || STATUS_CONFIG.healthy;
  const hasBeforeAfter = tooth.before_image && tooth.after_image;
  const hasProcedures = tooth.procedures && tooth.procedures.length > 0;
  
  // Определяем тип зуба для диаграммы поверхностей
  const toothDigit = tooth.tooth_number % 10;
  const isMolar = isChild ? toothDigit >= 4 : toothDigit >= 6;

  return (
    <Card className="w-full border-border/40 shadow-xl bg-card/98 backdrop-blur-sm animate-scale-in overflow-hidden">
      {/* Header with gradient accent */}
      <CardHeader className="pb-3 pt-4 px-5 relative bg-gradient-to-r from-muted/50 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-4">
          {/* Tooth number badge */}
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
            style={{ backgroundColor: config.color }}
          >
            {tooth.tooth_number}
          </div>
          
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Зуб №{tooth.tooth_number}</h3>
              <Badge variant="outline" className={cn("text-xs", config.bgClass)}>
                {config.label}
              </Badge>
            </div>
            {tooth.doctor_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {tooth.doctor_name}
              </p>
            )}
          </div>

          {/* Quick action button */}
          {!readOnly && doctorId && tooth.status !== 'removed' && (
            <QuickProcedureMenu 
              patientId={patientId}
              toothNumber={tooth.tooth_number}
              doctorId={doctorId}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0 pt-0">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-5 border-b">
            <TabsList className="h-10 w-full justify-start bg-transparent p-0 gap-4">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                <Activity className="h-4 w-4 mr-1.5" />
                Обзор
              </TabsTrigger>
              <TabsTrigger 
                value="surfaces" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Поверхности
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                <History className="h-4 w-4 mr-1.5" />
                История
              </TabsTrigger>
              <TabsTrigger 
                value="images" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                <Image className="h-4 w-4 mr-1.5" />
                Снимки
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[400px]">
            {/* Overview Tab */}
            <TabsContent value="overview" className="px-5 py-4 mt-0 space-y-5">
              {/* Risk Indicator */}
              <ToothRiskIndicator 
                patientId={patientId} 
                toothNumber={tooth.tooth_number}
                currentStatus={tooth.status}
              />

              {/* Before/After Photos */}
              {hasBeforeAfter && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="h-4 w-4 text-primary" />
                    До и после лечения
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">До</span>
                      <div className="aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted">
                        <img 
                          src={tooth.before_image!} 
                          alt="До лечения"
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">После</span>
                      <div className="aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted">
                        <img 
                          src={tooth.after_image!} 
                          alt="После лечения"
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {tooth.notes && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Заметки
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {tooth.notes}
                  </p>
                </div>
              )}

              {/* Materials */}
              {tooth.materials && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-primary" />
                    Использованные материалы
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {tooth.materials}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {tooth.recommendations && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Рекомендации
                  </div>
                  <p className="text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-lg border border-amber-500/20">
                    {tooth.recommendations}
                  </p>
                </div>
              )}

              {/* Treatment History (brief) */}
              {hasProcedures && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <History className="h-4 w-4 text-primary" />
                      Последние процедуры
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => setActiveTab('history')}
                    >
                      Все <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {tooth.procedures!.slice(0, 2).map((proc, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-xl bg-muted/50 border border-border/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 flex-1">
                            <p className="font-medium text-sm">{proc.name}</p>
                            <p className="text-xs text-muted-foreground">{proc.doctor}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">{proc.date}</span>
                            {proc.price && (
                              <p className="text-xs font-medium text-primary">
                                {proc.price.toLocaleString()} сум
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for healthy tooth */}
              {!hasBeforeAfter && !hasProcedures && !tooth.notes && !tooth.materials && !tooth.recommendations && tooth.status === 'healthy' && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="font-medium">Зуб здоров</p>
                  <p className="text-sm mt-1">Лечение не требуется</p>
                </div>
              )}

              {/* Footer info */}
              {tooth.updated_at && (
                <>
                  <Separator />
                  <div className="flex items-center justify-end text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Обновлено: {format(new Date(tooth.updated_at), 'd MMMM yyyy', { locale: ru })}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Surfaces Tab */}
            <TabsContent value="surfaces" className="px-5 py-4 mt-0">
              <ToothSurfacesDiagram 
                patientId={patientId}
                toothNumber={tooth.tooth_number}
                isMolar={isMolar}
                readOnly={readOnly}
              />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="px-5 py-4 mt-0">
              <ToothTimeline 
                patientId={patientId}
                toothNumber={tooth.tooth_number}
              />
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="px-5 py-4 mt-0">
              <ToothAttachmentsGallery 
                patientId={patientId}
                toothNumber={tooth.tooth_number}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
