import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  date: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
}

export function TransactionsList({ transactions }: TransactionsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние транзакции</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет транзакций</p>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {transaction.type === "income" ? (
                      <ArrowUpCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                    ) : (
                      <ArrowDownCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                    )}
                    <div>
                      <div className="font-medium">
                        {transaction.description || "Без описания"}
                      </div>
                      {transaction.category && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {transaction.category}
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(transaction.date), "d MMM yyyy, HH:mm", { locale: ru })}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      transaction.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatPrice(transaction.amount, 'сум', false)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
