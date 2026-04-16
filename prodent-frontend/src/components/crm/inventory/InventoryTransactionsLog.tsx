import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, Search, History } from "lucide-react";

interface Transaction {
  id: string;
  inventory_id: string;
  quantity: number;
  type: string;
  reason: string | null;
  created_at: string;
  user_id: string | null;
  inventory: {
    name: string;
    unit: string;
  } | null;
  profile: {
    full_name: string | null;
  } | null;
}

export function InventoryTransactionsLog() {
  const { currentClinic } = useClinic();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    if (currentClinic?.id) {
      loadTransactions();
    }
  }, [currentClinic]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_transactions")
      .select(`
        *,
        inventory:inventory_id(name, unit),
        profile:user_id(full_name)
      `)
      .eq("clinic_id", currentClinic!.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = !search || 
      tx.inventory?.name.toLowerCase().includes(search.toLowerCase()) ||
      tx.reason?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-foreground flex items-center gap-2">
            <History className="w-5 h-5" />
            Журнал операций
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="income">Приход</SelectItem>
                <SelectItem value="expense">Расход</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredTransactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Тип</TableHead>
                <TableHead>Материал</TableHead>
                <TableHead className="text-right">Кол-во</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {tx.type === "income" ? (
                      <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {tx.inventory?.name || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tx.type === "income" ? "default" : "destructive"}>
                      {tx.type === "income" ? "+" : "-"}{tx.quantity} {tx.inventory?.unit}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {tx.reason || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.profile?.full_name || "Система"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tx.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Нет операций</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
