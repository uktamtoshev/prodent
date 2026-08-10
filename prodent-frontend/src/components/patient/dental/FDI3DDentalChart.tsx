import {
  Component,
  lazy,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Baby,
  Box,
  Expand,
  Hand,
  History,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SmartToothDetailCard } from "./SmartToothDetailCard";
import {
  DentalChartApiError,
  DentalChartItem,
  getDentalChart,
} from "@/lib/dental-chart-api";
import {
  calculateDentalAge,
  DentitionType,
  getDentitionType,
  getFdiNumbers,
  normalizeToothStatus,
  TOOTH_STATUS_ORDER,
  ToothStatus,
} from "./fdiDentalModel";
import type { DentalView } from "./DentalScene3D";
import { DENTAL_3D_COPY } from "./dental3dCopy";

const DentalScene3D = lazy(() => import("./DentalScene3D"));

export interface FDI3DDentalChartProps {
  patientId?: string;
  birthDate?: string | null;
  readOnly?: boolean;
}

interface StatusPresentation {
  label: string;
  color: string;
  dotClass: string;
  icon: string;
}

class DentalSceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGlSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    if (!window.WebGL2RenderingContext) return false;
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type FormulaView = "permanent" | "primary";

function formulaFromStoredValue(value?: string | null): FormulaView | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["primary", "child", "deciduous"].includes(normalized)) return "primary";
  if (["adult", "permanent", "young", "adolescent"].includes(normalized)) return "permanent";
  return null;
}

function formulaForTooth(tooth: DentalChartItem): FormulaView | null {
  const quadrant = Math.floor(tooth.toothNumber / 10);
  if (quadrant >= 1 && quadrant <= 4) return "permanent";
  if (quadrant >= 5 && quadrant <= 8) return "primary";
  return formulaFromStoredValue(tooth.formulaType);
}

function buildStatusPresentation(
  t: (key: string) => string,
  noDataLabel: string,
): Record<ToothStatus, StatusPresentation> {
  return {
    unexamined: {
      label: noDataLabel,
      color: "#94a3b8",
      dotClass: "bg-slate-400",
      icon: "?",
    },
    healthy: {
      label: t("patientCabinet.toothHealthy"),
      color: "#10b981",
      dotClass: "bg-emerald-500",
      icon: "✓",
    },
    caries: {
      label: t("patientCabinet.toothCaries"),
      color: "#7c2d12",
      dotClass: "bg-amber-800",
      icon: "!",
    },
    filling: {
      label: t("patientCabinet.toothFilling"),
      color: "#64748b",
      dotClass: "bg-slate-500",
      icon: "●",
    },
    crown: {
      label: t("patientCabinet.toothCrown"),
      color: "#d6ad4a",
      dotClass: "bg-yellow-500",
      icon: "◆",
    },
    implant: {
      label: t("patientCabinet.toothImplant"),
      color: "#71717a",
      dotClass: "bg-zinc-500",
      icon: "I",
    },
    removed: {
      label: t("patientCabinet.toothRemoved"),
      color: "#9ca3af",
      dotClass: "bg-gray-400",
      icon: "×",
    },
    watch: {
      label: t("patientCabinet.toothWatch"),
      color: "#f97316",
      dotClass: "bg-orange-500",
      icon: "◉",
    },
    endo: {
      label: t("patientCabinet.toothEndo"),
      color: "#ef4444",
      dotClass: "bg-red-500",
      icon: "E",
    },
    periodontitis: {
      label: t("patientCabinet.toothPeriodontitis"),
      color: "#dc2626",
      dotClass: "bg-red-600",
      icon: "P",
    },
  };
}

function DentalScenePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#071414] text-white">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        <span className="text-xs text-white/70">FDI · 3D</span>
      </div>
    </div>
  );
}

function DentalFallback({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-950 to-emerald-950 p-8 text-center text-white">
      <div className="max-w-sm space-y-3">
        <Box className="mx-auto h-10 w-10 text-emerald-300" />
        <p className="font-medium">{message}</p>
        <p className="text-sm text-white/65">{hint}</p>
      </div>
    </div>
  );
}

function DentalSceneActivation({ onActivate, hint }: { onActivate: () => void; hint: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-950 via-[#071414] to-emerald-950 p-6 text-center text-white">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10">
          <Box className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">FDI · 3D</p>
          <p className="text-sm text-white/65">{hint}</p>
        </div>
        <Button
          type="button"
          onClick={onActivate}
          className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
        >
          3D
        </Button>
      </div>
    </div>
  );
}

function FdiNavigator({
  upper,
  lower,
  statuses,
  selectedTooth,
  presentation,
  onSelect,
  toothLabel,
  upperLabel,
  lowerLabel,
}: {
  upper: number[];
  lower: number[];
  statuses: Record<number, ToothStatus>;
  selectedTooth: number | null;
  presentation: Record<ToothStatus, StatusPresentation>;
  onSelect: (number: number) => void;
  toothLabel: string;
  upperLabel: string;
  lowerLabel: string;
}) {
  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, numbers: number[], index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    if (event.key === "ArrowRight") nextIndex = Math.min(numbers.length - 1, index + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = numbers.length - 1;
    document.querySelector<HTMLButtonElement>(`[data-fdi-tooth="${numbers[nextIndex]}"]`)?.focus();
  };

  const renderRow = (label: string, numbers: number[]) => (
    <div className="space-y-1.5">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]" role="group" aria-label={label}>
        {numbers.map((number, index) => {
          const status = statuses[number] || "unexamined";
          const config = presentation[status];
          const selected = selectedTooth === number;
          return (
            <button
              key={number}
              type="button"
              data-fdi-tooth={number}
              aria-pressed={selected}
              aria-label={`${toothLabel} ${number}: ${config.label}`}
              title={`${toothLabel} ${number} · ${config.label}`}
              onClick={() => onSelect(number)}
              onKeyDown={(event) => moveFocus(event, numbers, index)}
              className={cn(
                "relative flex h-9 min-w-0 items-center justify-center rounded-lg border text-[11px] font-bold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-card text-foreground hover:-translate-y-0.5 hover:border-primary/60 hover:bg-muted",
              )}
            >
              <span>{number}</span>
              {status !== "healthy" && (
                <span
                  className={cn("absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full", config.dotClass)}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-2" aria-label="FDI">
      {renderRow(upperLabel, upper)}
      <div className="flex items-center gap-2 px-1" aria-hidden="true">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">FDI</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {renderRow(lowerLabel, lower)}
    </div>
  );
}

export function FDI3DDentalChart({
  patientId,
  birthDate,
  readOnly = true,
}: FDI3DDentalChartProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const copy = DENTAL_3D_COPY[language];
  const effectivePatientId = patientId || user?.id;
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [view, setView] = useState<DentalView>("both");
  const [formulaView, setFormulaView] = useState<FormulaView | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [is3dEnabled, setIs3dEnabled] = useState(false);
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const statusPresentation = useMemo(
    () => buildStatusPresentation(t, copy.noData),
    [copy.noData, t],
  );

  useEffect(() => {
    if (!is3dEnabled) return;
    setWebGlAvailable(hasWebGlSupport());
  }, [is3dEnabled]);

  useEffect(() => {
    setSelectedTooth(null);
    setFormulaView(null);
    setView("both");
    setIs3dEnabled(false);
    setWebGlAvailable(null);
  }, [effectivePatientId]);

  const {
    data: teethData = [],
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
  } = useQuery({
    // The requester is part of the key so PHI cached for one signed-in user
    // can never be rendered after another user signs in in the same tab.
    queryKey: ["patient-teeth-ultra", user?.id, effectivePatientId],
    queryFn: async ({ signal }): Promise<DentalChartItem[]> => {
      if (!effectivePatientId) return [];
      const response = await getDentalChart(effectivePatientId, signal);
      return response.items;
    },
    enabled: Boolean(effectivePatientId),
    staleTime: 60_000,
    retry: (failureCount, queryError) => {
      if (
        queryError instanceof DentalChartApiError
        && queryError.status >= 400
        && queryError.status < 500
      ) return false;
      return failureCount < 1;
    },
  });

  const age = useMemo(() => calculateDentalAge(birthDate), [birthDate]);
  const availableFormulae = useMemo(
    () => new Set(teethData.map(formulaForTooth).filter(Boolean)),
    [teethData],
  );
  const hasPrimaryFormula = availableFormulae.has("primary");
  const hasPermanentFormula = availableFormulae.has("permanent");
  const fallbackDentition = age === null ? "adult" : getDentitionType(age);
  // Ages 6–12 can naturally have both primary and permanent teeth. Keep both
  // FDI formulae available even when no examination rows have been recorded yet.
  const ageSuggestsMixedDentition = age !== null && age >= 6 && age <= 12;
  const dataConflictsWithExpectedDentition = age !== null && (
    (age > 12 && hasPrimaryFormula)
    || (age < 6 && hasPermanentFormula)
  );
  const isMixedFormula = (
    (hasPrimaryFormula && hasPermanentFormula)
    || ageSuggestsMixedDentition
    || dataConflictsWithExpectedDentition
    || age === null
  );
  const defaultFormulaView: FormulaView = hasPrimaryFormula && !hasPermanentFormula
    ? "primary"
    : hasPermanentFormula
      ? "permanent"
      : fallbackDentition === "child"
        ? "primary"
        : "permanent";
  const activeFormulaView = isMixedFormula
    ? formulaView
      || (hasPrimaryFormula && !hasPermanentFormula
        ? "primary"
        : hasPermanentFormula && !hasPrimaryFormula
          ? "permanent"
          : age !== null && age < 10
            ? "primary"
            : "permanent")
    : defaultFormulaView;
  const hasRecordedWisdomTooth = teethData.some((tooth) => (
    formulaForTooth(tooth) === "permanent" && tooth.toothNumber % 10 === 8
  ));
  const permanentDentition: DentitionType = fallbackDentition === "adult" || hasRecordedWisdomTooth
    ? "adult"
    : "young";
  const dentition: DentitionType = activeFormulaView === "primary" ? "child" : permanentDentition;
  const fdiNumbers = useMemo(() => getFdiNumbers(dentition), [dentition]);

  useEffect(() => {
    if (!isMixedFormula) setFormulaView(null);
  }, [isMixedFormula]);

  const teethMap = useMemo(() => {
    const map = new Map<number, DentalChartItem>();
    teethData.forEach((tooth) => {
      const previous = map.get(tooth.toothNumber);
      const previousDate = previous?.updatedAt ? Date.parse(previous.updatedAt) : 0;
      const currentDate = tooth.updatedAt ? Date.parse(tooth.updatedAt) : 0;
      if (!previous || currentDate >= previousDate) map.set(tooth.toothNumber, tooth);
    });
    return map;
  }, [teethData]);

  const statuses = useMemo(() => {
    const result: Record<number, ToothStatus> = {};
    [...fdiNumbers.upper, ...fdiNumbers.lower].forEach((number) => {
      result[number] = normalizeToothStatus(teethMap.get(number)?.status);
    });
    return result;
  }, [fdiNumbers, teethMap]);

  const problemCount = useMemo(
    () => Object.values(statuses).filter((status) => !["unexamined", "healthy", "filling", "crown", "implant"].includes(status)).length,
    [statuses],
  );
  const healthyCount = useMemo(
    () => Object.values(statuses).filter((status) => status === "healthy").length,
    [statuses],
  );
  const unexaminedCount = useMemo(
    () => Object.values(statuses).filter((status) => status === "unexamined").length,
    [statuses],
  );

  useEffect(() => {
    if (selectedTooth && !fdiNumbers.upper.includes(selectedTooth) && !fdiNumbers.lower.includes(selectedTooth)) {
      setSelectedTooth(null);
    }
  }, [fdiNumbers, selectedTooth]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedTooth) {
        setSelectedTooth(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTooth]);

  const handleFullscreen = async () => {
    if (!fullscreenContainerRef.current?.requestFullscreen) return;
    try {
      await fullscreenContainerRef.current.requestFullscreen();
    } catch {
      // The browser may deny fullscreen; the complete inline chart stays usable.
      return;
    }
  };

  const selectedRecord = selectedTooth ? teethMap.get(selectedTooth) : undefined;
  const selectedStatus = selectedTooth ? statuses[selectedTooth] : "unexamined";
  const totalTeeth = fdiNumbers.upper.length + fdiNumbers.lower.length;
  const accessDenied = error instanceof DentalChartApiError && error.status === 403;
  const isScopedStaffView = Boolean(user?.id && effectivePatientId !== user.id);

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-border/50">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-[430px] w-full rounded-2xl" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!effectivePatientId || isError) {
    return (
      <Card className="overflow-hidden border-border/50 bg-card shadow-card">
        <CardContent className="flex min-h-[320px] items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground">
                {accessDenied ? copy.accessDeniedTitle : copy.loadFailedTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {accessDenied
                  ? copy.accessDeniedBody
                  : copy.loadFailedBody}
              </p>
            </div>
            {effectivePatientId && !accessDenied && (
              <Button
                type="button"
                variant="outline"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                <RotateCcw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                {copy.retryLoad}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={fullscreenContainerRef}
      className="fullscreen:overflow-auto fullscreen:bg-background fullscreen:p-3 sm:fullscreen:p-5"
    >
    <Card className="overflow-hidden border-border/50 bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-border/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{t("patientCabinet.toothFormula")}</h3>
              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">FDI · 3D</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {healthyCount}/{totalTeeth} {t("patientCabinet.healthyOf")}
            </p>
          </div>
          <Badge variant="outline" className="gap-1 rounded-full text-[11px]">
            {dentition === "child" ? <Baby className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {age === null ? copy.ageUnknown : `${age} ${t("patientCabinet.yearsLabel")}`}
          </Badge>
          {problemCount > 0 && (
            <Badge className="gap-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/10">
              <AlertTriangle className="h-3 w-3" />
              {problemCount}
            </Badge>
          )}
          {unexaminedCount > 0 && (
            <Badge variant="outline" className="gap-1 rounded-full text-slate-500">
              ? {unexaminedCount} {copy.withoutData}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMixedFormula && (
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1" aria-label={copy.formulaType}>
              <Button
                type="button"
                size="sm"
                variant={activeFormulaView === "permanent" ? "secondary" : "ghost"}
                aria-pressed={activeFormulaView === "permanent"}
                onClick={() => setFormulaView("permanent")}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <User className="h-3.5 w-3.5" />
                {copy.permanent}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeFormulaView === "primary" ? "secondary" : "ghost"}
                aria-pressed={activeFormulaView === "primary"}
                onClick={() => setFormulaView("primary")}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <Baby className="h-3.5 w-3.5" />
                {copy.primary}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
            {(["both", "upper", "lower"] as DentalView[]).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={view === mode ? "secondary" : "ghost"}
                aria-pressed={view === mode}
                aria-label={mode === "both" ? copy.bothJaws : mode === "upper" ? t("patientCabinet.upperJaw") : t("patientCabinet.lowerJaw")}
                onClick={() => setView(mode)}
                className="h-8 px-2.5 text-xs"
              >
                {mode === "both" ? "2" : mode === "upper" ? "↑" : "↓"}
              </Button>
            ))}
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={copy.resetModelAria}
              title={copy.resetPosition}
              disabled={!is3dEnabled}
              onClick={() => setResetKey((value) => value + 1)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={copy.fullscreenModelAria}
              title={copy.fullscreen}
              onClick={() => {
                setIs3dEnabled(true);
                void handleFullscreen();
              }}
            >
              <Expand className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-5">
        {isScopedStaffView && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{copy.scopeNotice}</p>
          </div>
        )}
        <div className={cn("grid gap-5", selectedTooth && "xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]")}>
          <div className="min-w-0 space-y-4">
            <div
              ref={sceneRef}
              tabIndex={-1}
              aria-busy={!is3dEnabled || webGlAvailable === null}
              className="relative h-[430px] overflow-hidden rounded-2xl border border-emerald-900/30 bg-[#071414] shadow-inner outline-none sm:h-[520px]"
            >
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-[11px] text-white/75 backdrop-blur">
                <Hand className="h-3.5 w-3.5 text-emerald-300" />
                {copy.controlsHint}
              </div>

              {!is3dEnabled && (
                <DentalSceneActivation
                  hint={copy.controlsHint}
                  onActivate={() => setIs3dEnabled(true)}
                />
              )}
              {is3dEnabled && webGlAvailable === null && <DentalScenePlaceholder />}
              {is3dEnabled && webGlAvailable === false && (
                <DentalFallback message={copy.webglUnavailable} hint={copy.fallbackFdiHint} />
              )}
              {is3dEnabled && webGlAvailable && (
                <DentalSceneBoundary
                  fallback={(
                    <DentalFallback message={copy.modelOpenFailed} hint={copy.fallbackFdiHint} />
                  )}
                >
                  <Suspense fallback={<DentalScenePlaceholder />}>
                    <DentalScene3D
                      dentition={dentition}
                      statuses={statuses}
                      selectedTooth={selectedTooth}
                      view={view}
                      resetKey={resetKey}
                      onSelectTooth={setSelectedTooth}
                      onWebGlLost={() => setWebGlAvailable(false)}
                    />
                  </Suspense>
                </DentalSceneBoundary>
              )}
            </div>

            <FdiNavigator
              upper={fdiNumbers.upper}
              lower={fdiNumbers.lower}
              statuses={statuses}
              selectedTooth={selectedTooth}
              presentation={statusPresentation}
              onSelect={setSelectedTooth}
              toothLabel={t("patientCabinet.toothLabel")}
              upperLabel={t("patientCabinet.upperJaw")}
              lowerLabel={t("patientCabinet.lowerJaw")}
            />

            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/40 pt-3">
              {TOOTH_STATUS_ORDER.map((status) => {
                const config = statusPresentation[status];
                return (
                  <div key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white", config.dotClass)}>
                      {config.icon}
                    </span>
                    {config.label}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedTooth ? (
            <aside aria-label={`${t("patientCabinet.toothLabel")} ${selectedTooth}`} className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <SmartToothDetailCard
                key={selectedTooth}
                tooth={{
                  ...(selectedRecord ? {
                    id: selectedRecord.id,
                    images: selectedRecord.images,
                    materials: selectedRecord.materials,
                    notes: selectedRecord.notes,
                    recommendations: selectedRecord.recommendations,
                    updated_at: selectedRecord.updatedAt,
                  } : {}),
                  tooth_number: selectedTooth,
                  status: selectedStatus,
                }}
                onClose={() => {
                  const toothToFocus = selectedTooth;
                  setSelectedTooth(null);
                  requestAnimationFrame(() => {
                    const toothButton = document.querySelector<HTMLButtonElement>(
                      `[data-fdi-tooth="${toothToFocus}"]`,
                    );
                    // Prefer the tooth button; keep the scene as a safe fallback
                    // during any transient render change.
                    (toothButton ?? sceneRef.current)?.focus();
                  });
                }}
                readOnly={readOnly}
                patientId={effectivePatientId || ""}
                isChild={dentition === "child"}
                defaultTab="history"
                showExtendedTabs={false}
              />
            </aside>
          ) : (
            <aside className="hidden min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center xl:flex">
              <div className="max-w-xs space-y-3 text-muted-foreground">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <History className="h-5 w-5" />
                </div>
                <p className="font-medium text-foreground">{copy.selectTooth}</p>
                <p className="text-sm">{copy.selectToothBody}</p>
              </div>
            </aside>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
