import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Camera,
  Stethoscope,
  Wrench,
  Eye,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { DentalChartApiError, getToothHistory } from "@/lib/dental-chart-api";
import { normalizeToothStatus } from "./fdiDentalModel";
import { DENTAL_3D_COPY } from "./dental3dCopy";

interface ToothTimelineProps {
  patientId: string;
  toothNumber: number;
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  caries: AlertCircle,
  filling: Wrench,
  crown: CheckCircle2,
  implant: CheckCircle2,
  endo: Stethoscope,
  photo: Camera,
  checkup: Eye,
  default: History,
};

const STATUS_COLORS: Record<string, string> = {
  caries: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  filling: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  crown: "text-yellow-600 bg-yellow-500/10 border-yellow-500/30",
  implant: "text-slate-600 bg-slate-500/10 border-slate-500/30",
  endo: "text-red-500 bg-red-500/10 border-red-500/30",
  healthy: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  watch: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  removed: "text-gray-500 bg-gray-500/10 border-gray-500/30",
  periodontitis: "text-red-600 bg-red-600/10 border-red-600/30",
  default: "text-primary bg-primary/10 border-primary/30",
};

const buildStatusLabels = (t: (key: string) => string): Record<string, string> => ({
  healthy: t("patientCabinet.toothHealthy"),
  caries: t("patientCabinet.toothCaries"),
  filling: t("patientCabinet.toothFilling"),
  crown: t("patientCabinet.toothCrown"),
  implant: t("patientCabinet.toothImplant"),
  removed: t("patientCabinet.toothRemoved"),
  watch: t("patientCabinet.toothWatch"),
  endo: t("patientCabinet.toothEndo"),
  periodontitis: t("patientCabinet.toothPeriodontitis"),
});

export function ToothTimeline({ patientId, toothNumber }: ToothTimelineProps) {
  const { t, language } = useLanguage();
  const copy = DENTAL_3D_COPY[language];
  const { user } = useAuth();
  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["tooth-history", user?.id, patientId, toothNumber],
    queryFn: ({ pageParam, signal }) => getToothHistory(patientId, toothNumber, {
      limit: 50,
      cursor: pageParam,
      signal,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;

      const cursorWasAlreadyUsed = allPages
        .slice(0, -1)
        .some(page => page.nextCursor === lastPage.nextCursor);

      return cursorWasAlreadyUsed ? undefined : lastPage.nextCursor;
    },
    enabled: Boolean(user?.id && patientId && toothNumber),
    staleTime: 30_000,
    retry: (failureCount, queryError) => {
      if (
        queryError instanceof DentalChartApiError
        && queryError.status >= 400
        && queryError.status < 500
      ) return false;
      return failureCount < 1;
    },
  });

  const historyData = useMemo(() => {
    const seenIds = new Set<string>();

    return (data?.pages ?? []).flatMap(page => page.items.filter(event => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      return true;
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("patientCabinet.historyOfChanges")}</span>
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map(item => (
            <Skeleton key={item} className="h-24 w-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError && historyData.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("patientCabinet.historyOfChanges")}</span>
        </div>
        <div
          role="alert"
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-5 text-center text-amber-800"
        >
          <AlertCircle className="mx-auto mb-2 h-7 w-7" />
          <p className="text-sm font-medium">{copy.historyUnavailableTitle}</p>
          <p className="mt-1 text-xs opacity-80">{copy.historyUnavailableBody}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-busy={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {isFetching ? copy.loading : copy.retry}
          </Button>
        </div>
      </div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("patientCabinet.historyOfChanges")}</span>
        </div>
        <div className="rounded-lg bg-muted/30 py-6 text-center text-muted-foreground">
          <History className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">{t("patientCabinet.noHistoryRecords")}</p>
        </div>
      </div>
    );
  }

  const retryFailedRequest = () => {
    if (isFetchNextPageError) {
      void fetchNextPage();
      return;
    }

    void refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{t("patientCabinet.historyOfChanges")}</span>
        <Badge variant="outline" className="text-xs">{historyData.length}</Badge>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {historyData.map((event, index) => {
            const statusAfter = normalizeToothStatus(event.statusAfter);
            const statusBefore = event.statusBefore
              ? normalizeToothStatus(event.statusBefore)
              : null;
            const Icon = STATUS_ICONS[statusAfter] || STATUS_ICONS.default;
            const colorClass = STATUS_COLORS[statusAfter] || STATUS_COLORS.default;
            const doctorName = event.doctorName;
            const clinicName = event.clinicName;

            return (
              <div
                key={event.id}
                className={cn(
                  "relative min-w-[180px] rounded-xl border bg-card p-3",
                  "transition-shadow duration-200 hover:shadow-md",
                )}
              >
                {index < historyData.length - 1 && (
                  <div className="absolute top-1/2 -right-3 h-0.5 w-3 bg-border" />
                )}

                <div className={cn(
                  "mb-2 flex h-8 w-8 items-center justify-center rounded-full border",
                  colorClass,
                )}>
                  <Icon className="h-4 w-4" />
                </div>

                <p className="mb-1 text-xs text-muted-foreground">
                  {format(new Date(event.createdAt), "dd.MM.yyyy")}
                </p>

                <div className="space-y-1">
                  {statusBefore && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">
                        {statusLabels[statusBefore] || statusBefore}
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-medium", colorClass)}
                  >
                    {statusLabels[statusAfter] || statusAfter}
                  </Badge>
                </div>

                {event.procedureName && (
                  <p className="mt-2 line-clamp-1 text-xs font-medium">
                    {event.procedureName}
                  </p>
                )}

                {(doctorName || clinicName) && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {doctorName || clinicName}
                  </p>
                )}

                {event.images && event.images.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span>
                      {event.images.length} {t("patientCabinet.photosCountSuffix")}
                    </span>
                  </div>
                )}

                {event.notes && (
                  <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                    &quot;{event.notes}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-amber-800"
        >
          <span className="text-xs">
            {isFetchNextPageError
              ? copy.nextPageFailed
              : copy.refreshHistoryFailed}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retryFailedRequest}
            disabled={isFetching}
            aria-busy={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {isFetching ? copy.loading : copy.retry}
          </Button>
        </div>
      )}

      {hasNextPage && !isError && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            aria-busy={isFetchingNextPage}
          >
            {isFetchingNextPage && (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isFetchingNextPage ? copy.loading : copy.showMore}
          </Button>
        </div>
      )}
    </div>
  );
}
