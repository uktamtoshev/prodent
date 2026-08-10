import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sklad, type SkladTransaction, type StockOpType } from "@/lib/sklad";

const TYPE_META: Record<StockOpType, { label: string; icon: typeof ArrowDownToLine; cls: string }> = {
  income: { label: "Приход", icon: ArrowDownToLine, cls: "text-success" },
  expense: { label: "Списание", icon: ArrowUpFromLine, cls: "text-destructive" },
  adjustment: { label: "Корректировка", icon: SlidersHorizontal, cls: "text-tashkent-sky" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Все" },
  { key: "income", label: "Приход" },
  { key: "expense", label: "Списание" },
  { key: "adjustment", label: "Корректировка" },
];

export default function SkladTransactions() {
  const [rows, setRows] = useState<SkladTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");

  useEffect(() => {
    setLoading(true);
    sklad
      .listTransactions(type ? { type } : {})
      .then(setRows)
      .catch((e) => toast.error(e?.message || "Не удалось загрузить движения"))
      .finally(() => setLoading(false));
  }, [type]);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const money = (n: number | null) => (n == null ? "—" : Number(n).toLocaleString("ru-RU"));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
          <ArrowLeftRight className="h-6 w-6 text-brand" />
          Движения
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Журнал партий, расходов на приёмы, перемещений и инвентаризаций</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setType(f.key)}
            className={cn(
              "h-8 rounded-prodent-input px-3 text-xs font-medium transition",
              type === f.key ? "bg-brand-50 text-brand-700" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-prodent border border-border bg-card shadow-design-card">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Дата</th>
              <th className="px-3 py-3">Позиция</th>
              <th className="px-3 py-3">Операция</th>
              <th className="px-3 py-3 text-right">Кол-во</th>
              <th className="px-3 py-3 text-right">Остаток</th>
              <th className="px-3 py-3 text-right">Сумма</th>
              <th className="px-3 py-3">Связь</th>
              <th className="px-3 py-3">Причина</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Загрузка…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">Движений пока нет</td></tr>
            ) : (
              rows.map((t) => {
                const meta = TYPE_META[t.type];
                const Icon = meta.icon;
                const qty = Number(t.quantity);
                return (
                  <tr key={t.id} className="border-t border-border/70">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmtDate(t.created_at)}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{t.item_name || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.cls)}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                    </td>
                    <td className={cn("px-3 py-3 text-right font-semibold tabular-nums", qty >= 0 ? "text-success" : "text-destructive")}>
                      {qty > 0 ? "+" : ""}{qty} <span className="text-xs font-normal text-muted-foreground">{t.item_unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {t.balance_after != null ? Number(t.balance_after) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{money(t.total_price)}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {t.appointment_id ? (
                        <span title={t.appointment_id}>Приём · {t.appointment_id.slice(0, 8)}</span>
                      ) : t.batch_id ? (
                        <span title={t.batch_id}>Партия · {t.batch_id.slice(0, 8)}</span>
                      ) : t.target_type || t.target_id ? (
                        <span title={t.target_id || undefined}>{t.target_type || "Перемещение"} · {t.target_id?.slice(0, 8) || "—"}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{t.reason || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
