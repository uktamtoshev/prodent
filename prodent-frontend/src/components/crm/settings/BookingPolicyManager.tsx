import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getClinicBookingPolicy,
  updateClinicBookingPolicy,
} from "@/lib/booking-policy-api";

export function BookingPolicyManager() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [maxDays, setMaxDays] = useState(30);

  const policyQuery = useQuery({
    queryKey: ["clinic-booking-policy", currentClinic?.id],
    enabled: !!currentClinic?.id,
    queryFn: () => getClinicBookingPolicy(currentClinic!.id),
  });

  useEffect(() => {
    if (!policyQuery.data) return;
    setEnabled(policyQuery.data.onlineBookingEnabled);
    setMaxDays(policyQuery.data.maxAdvanceBookingDays);
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!currentClinic?.id) throw new Error("No clinic selected");
      return updateClinicBookingPolicy({
        clinicId: currentClinic.id,
        onlineBookingEnabled: enabled,
        maxAdvanceBookingDays: Math.min(365, Math.max(0, maxDays)),
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        ["clinic-booking-policy", saved.clinicId],
        saved,
      );
      toast.success(t("crmBookingPolicy.saved"));
    },
    onError: () => toast.error(t("crmBookingPolicy.saveError")),
  });

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <CalendarClock className="h-5 w-5" />
          {t("crmBookingPolicy.title")}
        </CardTitle>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={policyQuery.isLoading || policyQuery.isError || saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </CardHeader>
      <CardContent>
        {policyQuery.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : policyQuery.isError ? (
          <div role="alert" className="text-sm text-destructive">
            {t("crmBookingPolicy.saveError")}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <Label htmlFor="online-booking-enabled" className="cursor-pointer">
                {t("crmBookingPolicy.enabled")}
              </Label>
              <Switch
                id="online-booking-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-max-days">
                {t("crmBookingPolicy.maxDays")}
              </Label>
              <div className="flex max-w-xs items-center gap-3">
                <Input
                  id="booking-max-days"
                  type="number"
                  min={0}
                  max={365}
                  value={maxDays}
                  onChange={(event) => setMaxDays(Number(event.target.value))}
                />
                <span className="text-sm text-muted-foreground">
                  {t("crmBookingPolicy.days")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("crmBookingPolicy.hint")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
