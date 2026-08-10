import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/types";
import { formatDate } from "@/lib/localization";
import { cn } from "@/lib/utils";
import { jobs } from "@/lib/jobs";
import {
  APPLICATION_FUNNEL, APPLICATION_STATUS_DOT, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONE,
} from "@/lib/jobs-constants";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      APPLICATION_STATUS_TONE[status] || "bg-muted text-muted-foreground")}>
      {APPLICATION_STATUS_LABELS[status] || status}
    </span>
  );
}

// Funnel progress for an application. Terminal rejected/withdrawn render muted.
export function ApplicationProgress({ status }: { status: string }) {
  const terminalBad = status === "rejected" || status === "withdrawn";
  const idx = APPLICATION_FUNNEL.indexOf(status);
  return (
    <div className="min-w-0 space-y-2 sm:flex sm:items-center sm:gap-1.5 sm:space-y-0">
      <div className="flex min-w-0 gap-1.5">
        {APPLICATION_FUNNEL.map((s, i) => {
          const reached = !terminalBad && idx >= 0 && i <= idx;
          return (
            <div
              key={s}
              title={APPLICATION_STATUS_LABELS[s]}
              className={cn("h-1.5 min-w-0 flex-1 rounded-full transition-colors sm:w-7 sm:flex-none",
                reached ? "bg-brand" : terminalBad ? "bg-destructive/30" : "bg-muted")}
            />
          );
        })}
      </div>
      <span className="block sm:ml-2"><StatusBadge status={status} /></span>
    </div>
  );
}

function fmtDateTime(iso: string | undefined, language: Language): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return formatDate(d, language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface AppEvent { to_status: string; created_at: string; note?: string | null; actor_role?: string | null }

// Dated status history for an application — each status change with its date.
// Falls back to a single "created" row when no events are recorded yet.
export function ApplicationTimeline({ events, createdAt, status }: {
  events?: AppEvent[]; createdAt?: string; status: string;
}) {
  const { language } = useLanguage();
  const rows: { status: string; at: string }[] =
    events && events.length
      ? events.map((e) => ({ status: e.to_status, at: e.created_at }))
      : [{ status, at: createdAt || "" }];
  return (
    <ol className="mt-3 space-y-1.5 border-l border-border pl-3.5">
      {rows.map((r, i) => (
        <li key={i} className="relative flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className={cn("absolute -left-[18px] h-2.5 w-2.5 rounded-full ring-2 ring-card",
            APPLICATION_STATUS_DOT[r.status] || "bg-muted-foreground/50")} />
          <span className="font-semibold text-foreground">{APPLICATION_STATUS_LABELS[r.status] || r.status}</span>
          {r.at && <span className="text-muted-foreground">· {fmtDateTime(r.at, language)}</span>}
        </li>
      ))}
    </ol>
  );
}

// Report a listing or resume for moderation.
export function ReportButton({ targetType, targetId }: { targetType: "listing" | "resume"; targetId: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error(t("jobs.shared.report.reasonRequired")); return; }
    setBusy(true);
    try {
      await jobs.report(targetType, targetId, reason.trim());
      toast.success(t("jobs.shared.report.success"));
      setOpen(false);
      setReason("");
    } catch {
      toast.error(t("jobs.shared.report.failure"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive">
          <Flag className="h-3.5 w-3.5" /> {t("jobs.shared.report.button")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {t(targetType === "listing" ? "jobs.shared.report.titleListing" : "jobs.shared.report.titleResume")}
          </DialogTitle>
        </DialogHeader>
        <Textarea placeholder={t("jobs.shared.report.placeholder")} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("jobs.shared.report.cancel")}</Button>
          <Button onClick={submit} disabled={busy}>{t("jobs.shared.report.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-prodent border border-dashed border-border bg-card py-16 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="rounded-prodent border border-destructive/30 bg-destructive/5 p-5">
      <p className="font-semibold text-destructive">{t("jobs.shared.loadError")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button className="mt-3 min-h-11" onClick={onRetry}>{t("jobs.shared.retry")}</Button>
    </div>
  );
}
