import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/localization";
import type { Language } from "@/i18n/types";

/**
 * Операции по лицевому счёту — содержимое вкладки «Операции».
 *
 * Живёт отдельным компонентом, потому что этот же список нужен и клинике, и
 * врачу. Раньше вкладка «Операции» существовала, но не показывала ничего:
 * переключатель менял только цвет кнопки, а содержимое под ним оставалось
 * прежним. Пустая вкладка хуже отсутствующей — она обещает данные, которых
 * не даёт.
 */
export interface BalanceOperationRow {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  payment_status: string;
  description: string | null;
  created_at: string;
}

interface BalanceOperationsProps {
  transactions?: BalanceOperationRow[];
  language: Language;
  /** Запрос операций упал. Пустой список в этом случае показывать НЕЛЬЗЯ. */
  isError?: boolean;
  /** Запрос идёт. */
  isLoading?: boolean;
  /** Ответ получен успешно — только тогда пустой список означает «операций нет». */
  isLoaded?: boolean;
  /** Повторить запрос операций. */
  onRetry?: () => void;
  labels: {
    date: string;
    operation: string;
    amount: string;
    balance: string;
    status: string;
    empty: string;
    error: string;
    retry: string;
    loading: string;
  };
}

/** Тон чипа по статусу платежа. Цвет дублируется текстом самого статуса. */
function statusTone(status: string): "ok" | "warn" | "danger" | "muted" {
  const value = status.toLowerCase();
  if (value === "completed" || value === "success") return "ok";
  if (value === "pending" || value === "processing") return "warn";
  if (value === "failed" || value === "cancelled") return "danger";
  return "muted";
}

/** Пополнение показываем со знаком плюс, списание — со знаком минус. */
function signedAmount(row: BalanceOperationRow, language: Language): string {
  const isIncome = row.transaction_type.toLowerCase() === "topup"
    || row.transaction_type.toLowerCase() === "refund";
  const sign = isIncome ? "+" : "−";
  return `${sign}${formatAmount(Math.abs(Number(row.amount ?? 0)), language)}`;
}

export function BalanceOperations({
  transactions,
  language,
  isError,
  isLoading,
  isLoaded,
  onRetry,
  labels,
}: BalanceOperationsProps) {
  const rows = transactions ?? [];

  /* Порядок веток важен и обратен привычному.
     Сначала ОШИБКА: иначе упавший запрос отдаёт пустой массив и экран
     показывает спокойное «Операций пока нет» — то есть уверенно врёт про
     деньги. Разница между «операций не было» и «мы не смогли их загрузить»
     здесь принципиальная: в первом случае человек спокоен, во втором должен
     нажать «Повторить». */
  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="space-y-3 py-14 text-center" role="alert">
          <p className="text-muted-foreground">{labels.error}</p>
          {onRetry && (
            <Button variant="outline" size="cabinet" onClick={onRetry}>
              {labels.retry}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-14 text-center text-muted-foreground" role="status">
          {labels.loading}
        </CardContent>
      </Card>
    );
  }

  /* Пустой список — ТОЛЬКО после успешного ответа. Пока про успех ничего не
     известно (isLoaded не передан или false), «пусто» не утверждаем. */
  if (rows.length === 0) {
    if (isLoaded === false) return null;
    return (
      <Card className="border-dashed">
        <CardContent className="py-14 text-center text-muted-foreground" role="status">
          {labels.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.date}</TableHead>
              <TableHead>{labels.operation}</TableHead>
              {/* Суммы выравниваем вправо и печатаем табличными цифрами:
                  иначе разряды не встают друг под друга и колонку невозможно
                  просмотреть глазом сверху вниз. */}
              <TableHead className="text-right">{labels.amount}</TableHead>
              <TableHead className="text-right">{labels.balance}</TableHead>
              <TableHead>{labels.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {new Date(row.created_at).toLocaleDateString("en-CA")}
                </TableCell>
                <TableCell className="max-w-[280px] truncate">
                  {row.description || row.transaction_type}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {signedAmount(row, language)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatAmount(Number(row.balance_after ?? 0), language)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusTone(row.payment_status)} dot="round">
                    {row.payment_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
