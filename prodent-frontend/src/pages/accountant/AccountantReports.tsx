import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, WalletCards } from "lucide-react";
import { AccountantLayout } from "@/components/accountant/AccountantLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lab, type LabClinicRevenue } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";

const money = (value: number) =>
  `${Math.round(Number(value) || 0).toLocaleString("ru-RU")} сум`;

export default function AccountantReports() {
  const [rows, setRows] = useState<LabClinicRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await lab.clinicRevenue());
    } catch (cause: unknown) {
      setError(getErrorMessage(cause, "Не удалось загрузить отчёт"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          orders: sum.orders + Number(row.orders || 0),
          paid: sum.paid + Number(row.paid_revenue || 0),
          debt: sum.debt + Number(row.receivable_revenue || 0),
          materials: sum.materials + Number(row.materials_cost || 0),
        }),
        { orders: 0, paid: 0, debt: 0, materials: 0 },
      ),
    [rows],
  );

  return (
    <AccountantLayout>
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Финансовые отчёты</h1>
            <p className="text-sm text-muted-foreground">
              Только общие суммы лаборатории — без пациентов, файлов и переписки.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Повторить
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Заказы", String(totals.orders)],
            ["Оплачено", money(totals.paid)],
            ["Долг", money(totals.debt)],
            ["Материалы", money(totals.materials)],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{loading ? "—" : value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletCards className="h-5 w-5" />
              Лаборатория по клиникам
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                За выбранный период данных нет.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Клиника</th>
                      <th className="px-4 py-3 text-right font-medium">Заказы</th>
                      <th className="px-4 py-3 text-right font-medium">Оплачено</th>
                      <th className="px-4 py-3 text-right font-medium">Долг</th>
                      <th className="px-4 py-3 text-right font-medium">Не оплачено</th>
                      <th className="px-4 py-3 text-right font-medium">Материалы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.clinic_id || row.clinic_name} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{row.clinic_name || "Без клиники"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.orders}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(row.paid_revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(row.receivable_revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.unpaid_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(row.materials_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AccountantLayout>
  );
}
