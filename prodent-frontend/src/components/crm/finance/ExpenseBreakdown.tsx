import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ExpenseItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface ExpenseBreakdownProps {
  expenses: ExpenseItem[];
  totalExpenses: number;
}

export function ExpenseBreakdown({ expenses, totalExpenses }: ExpenseBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Расходы по категориям</CardTitle>
        <p className="text-sm text-muted-foreground">
          Всего расходов: {totalExpenses.toLocaleString()} UZS
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {expenses.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Нет данных о расходах</p>
        ) : (
          expenses.map((expense) => (
            <div key={expense.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: expense.color }}
                  />
                  <span className="text-sm font-medium">{expense.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {expense.percentage.toFixed(1)}%
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {expense.amount.toLocaleString()} UZS
                  </span>
                </div>
              </div>
              <Progress value={expense.percentage} className="h-2" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
