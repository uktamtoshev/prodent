import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  FileText,
  FlaskConical,
  History,
  Inbox,
  MessageCircle,
  Store,
  Wallet,
  Wrench,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { lab } from "@/lib/lab";
import {
  RoleSidebar,
  RoleSidebarNavItem,
} from "@/components/shared/RoleSidebar";

interface LabStats {
  inQueue: number;
  inProgress: number;
  dueToday: number;
  monthDone: number;
}

export function TechnicianSidebar() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<LabStats>({ inQueue: 0, inProgress: 0, dueToday: 0, monthDone: 0 });

  // Scoped counters off the lab API (incoming 'new' orders count toward the
  // Заказы badge — they need the technician's attention).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await lab.stats();
        if (!active) return;
        setStats({
          inQueue: Number(s.incoming) + Number(s.queued),
          inProgress: Number(s.in_work),
          dueToday: Number(s.due_today),
          monthDone: Number(s.done30),
        });
      } catch {
        // Non-fatal: the sidebar just keeps zero counters.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const items: RoleSidebarNavItem[] = useMemo(
    () => [
      { title: t("technician.orders"), path: "/technician", icon: Inbox, end: true, badge: stats.inQueue || undefined },
      { title: t("technician.production"), path: "/technician/production", icon: Wrench },
      { title: t("technician.currentOrder"), path: "/technician/order", icon: FileText },
      { title: t("technician.archive"), path: "/technician/archive", icon: History },
      { title: t("technician.messages"), path: "/technician/messages", icon: MessageCircle },
      { title: t("technician.materials"), path: "/technician/materials", icon: FlaskConical },
      { title: t("technician.finance"), path: "/technician/finance", icon: CreditCard },
      { title: "Расчёты", path: "/technician/settlements", icon: Wallet },
      { title: t("technician.profile"), path: "/technician/profile", icon: Store },
    ],
    [t, stats.inQueue]
  );

  const todayStats = (
    <div className="rounded-md border border-sidebar-border bg-sidebar-hover p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
        {t("technician.today")}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] text-sidebar-muted">{t("technician.inProgress")}</div>
        <div className="text-[15px] font-bold tabular-nums text-white">{stats.inProgress}</div>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <div className="text-[11px] text-sidebar-muted">{t("technician.dueToday")}</div>
        <div className="text-[15px] font-bold tabular-nums text-amber-300">{stats.dueToday}</div>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <div className="text-[11px] text-sidebar-muted">{t("technician.monthly")}</div>
        <div className="text-[15px] font-bold tabular-nums text-sidebar-active">{stats.monthDone}</div>
      </div>
    </div>
  );

  return (
    <RoleSidebar
      roleLabel={t("technician.labShort")}
      items={items}
      extra={todayStats}
    />
  );
}
