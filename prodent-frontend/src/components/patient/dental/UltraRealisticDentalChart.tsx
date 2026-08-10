import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FDI3DDentalChartProps } from "./FDI3DDentalChart";

const FDI3DDentalChart = lazy(() =>
  import("./FDI3DDentalChart").then((module) => ({
    default: module.FDI3DDentalChart,
  })),
);

function DentalChartLoading() {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/90 shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <Skeleton className="h-[320px] w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}

export function UltraRealisticDentalChart(props: FDI3DDentalChartProps) {
  return (
    <Suspense fallback={<DentalChartLoading />}>
      <FDI3DDentalChart {...props} />
    </Suspense>
  );
}
