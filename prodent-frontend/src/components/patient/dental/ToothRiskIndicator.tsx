import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Shield, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ToothRiskIndicatorProps {
  patientId: string;
  toothNumber: number;
  currentStatus?: string;
}

const buildRiskConfig = (t: (k: string) => string): Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  progressColor: string;
}> => ({
  low: {
    label: t("patientCabinet.riskLow"),
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: Shield,
    progressColor: 'bg-emerald-500',
  },
  medium: {
    label: t("patientCabinet.riskMedium"),
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: AlertCircle,
    progressColor: 'bg-amber-500',
  },
  high: {
    label: t("patientCabinet.riskHigh"),
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: AlertTriangle,
    progressColor: 'bg-red-500',
  },
});

// Compute risk from status (used when no AI prediction)
const calculateRiskFromStatus = (status?: string): { level: string; score: number } => {
  switch (status) {
    case 'healthy':
    case 'filling':
    case 'crown':
    case 'implant':
      return { level: 'low', score: 15 };
    case 'watch':
    case 'caries':
      return { level: 'medium', score: 55 };
    case 'endo':
    case 'periodontitis':
    case 'decay':
      return { level: 'high', score: 85 };
    case 'removed':
      return { level: 'low', score: 0 };
    default:
      return { level: 'low', score: 10 };
  }
};

export function ToothRiskIndicator({ patientId, toothNumber, currentStatus }: ToothRiskIndicatorProps) {
  const { t } = useLanguage();
  const RISK_CONFIG = useMemo(() => buildRiskConfig(t), [t]);
  const { data: prediction } = useQuery({
    queryKey: ['tooth-prediction', patientId, toothNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('tooth_predictions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('tooth_number', toothNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId && !!toothNumber,
  });

  // Используем AI-прогноз если есть, иначе рассчитываем из статуса
  const riskData = prediction 
    ? { 
        level: prediction.risk_level || 'low', 
        score: (prediction.confidence_score || 0.5) * 100,
        recommendation: prediction.recommended_action,
        nextCheckup: prediction.next_checkup_date,
      }
    : {
        ...calculateRiskFromStatus(currentStatus),
        recommendation: null,
        nextCheckup: null,
      };

  const config = RISK_CONFIG[riskData.level] || RISK_CONFIG.low;
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-4 rounded-xl border",
      config.bgColor,
      config.borderColor
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            config.bgColor,
            config.color
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("patientCabinet.riskLevel")}</p>
            <Badge
              variant="outline"
              className={cn("text-xs mt-0.5", config.color, config.borderColor)}
            >
              {config.label}
            </Badge>
          </div>
        </div>

        {prediction && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{t("patientCabinet.aiPrediction")}</span>
          </div>
        )}
      </div>

      {/* Risk score bar */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t("patientCabinet.riskIndex")}</span>
          <span className={cn("font-medium", config.color)}>{Math.round(riskData.score)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", config.progressColor)}
            style={{ width: `${riskData.score}%` }}
          />
        </div>
      </div>

      {/* Next checkup */}
      {riskData.nextCheckup && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{t("patientCabinet.nextCheckup")}</span>
          <span className="font-medium">
            {format(new Date(riskData.nextCheckup), 'd MMMM yyyy', { locale: ru })}
          </span>
        </div>
      )}

      {/* AI Recommendation */}
      {riskData.recommendation && (
        <div className={cn(
          "mt-3 p-2.5 rounded-lg text-xs",
          "bg-background/50 border border-border/50"
        )}>
          <p className="font-medium mb-1 flex items-center gap-1">
            💡 {t("patientCabinet.recommendation")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {riskData.recommendation}
          </p>
        </div>
      )}

      {/* Fallback message when no prediction */}
      {!prediction && currentStatus && (
        <p className="text-xs text-muted-foreground mt-2">
          {currentStatus === 'healthy'
            ? t("patientCabinet.preventiveCheckup")
            : currentStatus === 'caries' || currentStatus === 'watch'
            ? t("patientCabinet.treatmentSoon")
            : currentStatus === 'endo' || currentStatus === 'periodontitis'
            ? t("patientCabinet.urgentTreatment")
            : t("patientCabinet.regularControl")}
        </p>
      )}
    </div>
  );
}
