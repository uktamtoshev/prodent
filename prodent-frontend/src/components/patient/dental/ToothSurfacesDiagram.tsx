import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

type SurfaceStatus = 'healthy' | 'caries' | 'filling' | 'decay' | 'crown' | 'veneer';
type SurfaceType = 'occlusal' | 'mesial' | 'distal' | 'buccal' | 'lingual' | 'incisal';

const buildSurfaceConfig = (t: (k: string) => string): Record<SurfaceStatus, { label: string; color: string; bgColor: string }> => ({
  healthy: { label: t("patientCabinet.surfaceHealthy"), color: '#10B981', bgColor: '#ECFDF5' },
  caries: { label: t("patientCabinet.surfaceCaries"), color: '#F59E0B', bgColor: '#FFFBEB' },
  filling: { label: t("patientCabinet.surfaceFilling"), color: '#3B82F6', bgColor: '#EFF6FF' },
  decay: { label: t("patientCabinet.surfaceDecay"), color: '#EF4444', bgColor: '#FEF2F2' },
  crown: { label: t("patientCabinet.surfaceCrown"), color: '#8B5CF6', bgColor: '#F5F3FF' },
  veneer: { label: t("patientCabinet.surfaceVeneer"), color: '#06B6D4', bgColor: '#ECFEFF' },
});

const buildSurfaceLabels = (t: (k: string) => string): Record<SurfaceType, { ru: string; short: string }> => ({
  occlusal: { ru: t("patientCabinet.surfaceOcclusal"), short: 'O' },
  mesial: { ru: t("patientCabinet.surfaceMesial"), short: 'M' },
  distal: { ru: t("patientCabinet.surfaceDistal"), short: 'D' },
  buccal: { ru: t("patientCabinet.surfaceBuccal"), short: 'B' },
  lingual: { ru: t("patientCabinet.surfaceLingual"), short: 'L' },
  incisal: { ru: t("patientCabinet.surfaceIncisal"), short: 'I' },
});

interface ToothSurfacesDiagramProps {
  patientId: string;
  toothNumber: number;
  isMolar?: boolean;
  readOnly?: boolean;
  onSurfaceClick?: (surface: SurfaceType, status: SurfaceStatus) => void;
}

export function ToothSurfacesDiagram({
  patientId,
  toothNumber,
  isMolar = true,
  readOnly = false,
  onSurfaceClick
}: ToothSurfacesDiagramProps) {
  const { t } = useLanguage();
  const SURFACE_CONFIG = useMemo(() => buildSurfaceConfig(t), [t]);
  const SURFACE_LABELS = useMemo(() => buildSurfaceLabels(t), [t]);
  const queryClient = useQueryClient();
  const [hoveredSurface, setHoveredSurface] = useState<SurfaceType | null>(null);

  const { data: surfacesData } = useQuery({
    queryKey: ['tooth-surfaces', patientId, toothNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('tooth_surfaces')
        .select('*')
        .eq('patient_id', patientId)
        .eq('tooth_number', toothNumber);
      return data || [];
    },
    enabled: !!patientId && !!toothNumber,
  });

  const updateSurfaceMutation = useMutation({
    mutationFn: async ({ surface, status }: { surface: SurfaceType; status: SurfaceStatus }) => {
      const { error } = await supabase
        .from('tooth_surfaces')
        .upsert({
          patient_id: patientId,
          tooth_number: toothNumber,
          surface,
          status,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'patient_id,tooth_number,surface' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tooth-surfaces', patientId, toothNumber] });
    },
  });

  const getSurfaceStatus = (surface: SurfaceType): SurfaceStatus => {
    const found = surfacesData?.find(s => s.surface === surface);
    return (found?.status as SurfaceStatus) || 'healthy';
  };

  const handleSurfaceClick = (surface: SurfaceType) => {
    if (readOnly) return;
    const currentStatus = getSurfaceStatus(surface);
    const statuses: SurfaceStatus[] = ['healthy', 'caries', 'filling', 'decay', 'crown', 'veneer'];
    const nextIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];
    
    updateSurfaceMutation.mutate({ surface, status: nextStatus });
    onSurfaceClick?.(surface, nextStatus);
  };

  // Pick which surfaces to render based on tooth type
  const surfaces: SurfaceType[] = isMolar
    ? ['occlusal', 'mesial', 'distal', 'buccal', 'lingual']
    : ['incisal', 'mesial', 'distal', 'buccal', 'lingual'];

  const centerSurface = surfaces[0]; // occlusal or incisal

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{t("patientCabinet.toothSurfaces")} #{toothNumber}</span>
        {!readOnly && (
          <Badge variant="outline" className="text-xs">{t("patientCabinet.clickToChange")}</Badge>
        )}
      </div>

      {/* 5-surface diagram */}
      <TooltipProvider>
        <div className="relative w-32 h-32 mx-auto">
          {/* Center surface (Occlusal/Incisal) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSurfaceClick(centerSurface)}
                onMouseEnter={() => setHoveredSurface(centerSurface)}
                onMouseLeave={() => setHoveredSurface(null)}
                className={cn(
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                  "w-14 h-14 rounded-lg border-2 transition-all duration-200",
                  "flex items-center justify-center font-medium text-sm",
                  hoveredSurface === centerSurface && "scale-110 shadow-lg",
                  !readOnly && "cursor-pointer hover:shadow-md"
                )}
                style={{
                  backgroundColor: SURFACE_CONFIG[getSurfaceStatus(centerSurface)].bgColor,
                  borderColor: SURFACE_CONFIG[getSurfaceStatus(centerSurface)].color,
                  color: SURFACE_CONFIG[getSurfaceStatus(centerSurface)].color,
                }}
              >
                {SURFACE_LABELS[centerSurface].short}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{SURFACE_LABELS[centerSurface].ru}</p>
              <p className="text-xs text-muted-foreground">{SURFACE_CONFIG[getSurfaceStatus(centerSurface)].label}</p>
            </TooltipContent>
          </Tooltip>

          {/* Mesial (Left) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSurfaceClick('mesial')}
                onMouseEnter={() => setHoveredSurface('mesial')}
                onMouseLeave={() => setHoveredSurface(null)}
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2",
                  "w-8 h-14 rounded-l-lg border-2 transition-all duration-200",
                  "flex items-center justify-center font-medium text-xs",
                  hoveredSurface === 'mesial' && "scale-110 shadow-lg",
                  !readOnly && "cursor-pointer hover:shadow-md"
                )}
                style={{
                  backgroundColor: SURFACE_CONFIG[getSurfaceStatus('mesial')].bgColor,
                  borderColor: SURFACE_CONFIG[getSurfaceStatus('mesial')].color,
                  color: SURFACE_CONFIG[getSurfaceStatus('mesial')].color,
                }}
              >
                M
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{SURFACE_LABELS.mesial.ru}</p>
              <p className="text-xs text-muted-foreground">{SURFACE_CONFIG[getSurfaceStatus('mesial')].label}</p>
            </TooltipContent>
          </Tooltip>

          {/* Distal (Right) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSurfaceClick('distal')}
                onMouseEnter={() => setHoveredSurface('distal')}
                onMouseLeave={() => setHoveredSurface(null)}
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2",
                  "w-8 h-14 rounded-r-lg border-2 transition-all duration-200",
                  "flex items-center justify-center font-medium text-xs",
                  hoveredSurface === 'distal' && "scale-110 shadow-lg",
                  !readOnly && "cursor-pointer hover:shadow-md"
                )}
                style={{
                  backgroundColor: SURFACE_CONFIG[getSurfaceStatus('distal')].bgColor,
                  borderColor: SURFACE_CONFIG[getSurfaceStatus('distal')].color,
                  color: SURFACE_CONFIG[getSurfaceStatus('distal')].color,
                }}
              >
                D
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{SURFACE_LABELS.distal.ru}</p>
              <p className="text-xs text-muted-foreground">{SURFACE_CONFIG[getSurfaceStatus('distal')].label}</p>
            </TooltipContent>
          </Tooltip>

          {/* Buccal (Top) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSurfaceClick('buccal')}
                onMouseEnter={() => setHoveredSurface('buccal')}
                onMouseLeave={() => setHoveredSurface(null)}
                className={cn(
                  "absolute top-0 left-1/2 -translate-x-1/2",
                  "w-14 h-8 rounded-t-lg border-2 transition-all duration-200",
                  "flex items-center justify-center font-medium text-xs",
                  hoveredSurface === 'buccal' && "scale-110 shadow-lg",
                  !readOnly && "cursor-pointer hover:shadow-md"
                )}
                style={{
                  backgroundColor: SURFACE_CONFIG[getSurfaceStatus('buccal')].bgColor,
                  borderColor: SURFACE_CONFIG[getSurfaceStatus('buccal')].color,
                  color: SURFACE_CONFIG[getSurfaceStatus('buccal')].color,
                }}
              >
                B
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{SURFACE_LABELS.buccal.ru}</p>
              <p className="text-xs text-muted-foreground">{SURFACE_CONFIG[getSurfaceStatus('buccal')].label}</p>
            </TooltipContent>
          </Tooltip>

          {/* Lingual (Bottom) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSurfaceClick('lingual')}
                onMouseEnter={() => setHoveredSurface('lingual')}
                onMouseLeave={() => setHoveredSurface(null)}
                className={cn(
                  "absolute bottom-0 left-1/2 -translate-x-1/2",
                  "w-14 h-8 rounded-b-lg border-2 transition-all duration-200",
                  "flex items-center justify-center font-medium text-xs",
                  hoveredSurface === 'lingual' && "scale-110 shadow-lg",
                  !readOnly && "cursor-pointer hover:shadow-md"
                )}
                style={{
                  backgroundColor: SURFACE_CONFIG[getSurfaceStatus('lingual')].bgColor,
                  borderColor: SURFACE_CONFIG[getSurfaceStatus('lingual')].color,
                  color: SURFACE_CONFIG[getSurfaceStatus('lingual')].color,
                }}
              >
                L
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{SURFACE_LABELS.lingual.ru}</p>
              <p className="text-xs text-muted-foreground">{SURFACE_CONFIG[getSurfaceStatus('lingual')].label}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {Object.entries(SURFACE_CONFIG).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-1">
            <div 
              className="w-2.5 h-2.5 rounded-full border"
              style={{ backgroundColor: color, borderColor: color }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
