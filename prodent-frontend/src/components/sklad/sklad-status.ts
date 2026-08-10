export type StockStatus = "ok" | "low" | "critical" | "out" | "expiring";

export function stockStatus(it: {
  quantity: number;
  min_quantity: number;
  expiry_date: string | null;
}): StockStatus {
  if (it.quantity <= 0) return "out";
  if (it.min_quantity > 0 && it.quantity < it.min_quantity * 0.5) return "critical";
  if (it.min_quantity > 0 && it.quantity <= it.min_quantity) return "low";
  if (it.expiry_date) {
    const days = Math.round((new Date(it.expiry_date).getTime() - Date.now()) / 86400000);
    if (days < 30) return "expiring";
  }
  return "ok";
}

export const STATUS_META: Record<StockStatus, { key: string; cls: string; dot: string }> = {
  ok: { key: "sklad.status.ok", cls: "bg-success/10 text-success", dot: "bg-success" },
  low: { key: "sklad.status.low", cls: "bg-warning/10 text-warning", dot: "bg-warning" },
  critical: { key: "sklad.status.critical", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  out: { key: "sklad.status.out", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  expiring: { key: "sklad.status.expiring", cls: "bg-warning/10 text-warning", dot: "bg-warning" },
};
