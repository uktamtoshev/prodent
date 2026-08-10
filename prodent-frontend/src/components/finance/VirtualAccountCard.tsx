import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle, Clock, Plus, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { PaymeTopupFlow } from './PaymeTopupFlow';
import paymeLogo from '@/assets/payments/payme-logo.png';
import clickLogo from '@/assets/payments/click-logo.png';
import uzumLogo from '@/assets/payments/uzum-logo.png';

interface VirtualAccountCardProps {
  type: 'doctor' | 'clinic';
  entityId: string;
  entityName?: string;
}

const paymentProviders = [
  { id: 'payme', name: 'Payme', logo: paymeLogo },
  { id: 'click', name: 'Click', logo: clickLogo },
  { id: 'uzumbank', name: 'Uzum Bank', logo: uzumLogo },
] as const;

export function VirtualAccountCard({ type, entityId, entityName }: VirtualAccountCardProps) {
  const { account, transactions, isLoading, topup, isTopupLoading, refresh } = useVirtualAccount(type, entityId);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'payme' | 'click' | 'uzumbank' | null>(null);
  const [isPaymeFlowOpen, setIsPaymeFlowOpen] = useState(false);

  const handleTopup = () => {
    if (!account || !selectedProvider || !amount) return;

    if (selectedProvider === 'payme') {
      setIsTopupOpen(false);
      setIsPaymeFlowOpen(true);
      return;
    }

    topup({
      account_id: account.id,
      amount: parseInt(amount),
      provider: selectedProvider,
    });

    setIsTopupOpen(false);
    setAmount('');
    setSelectedProvider(null);
  };

  const formatAmount = (value: number) => new Intl.NumberFormat('ru-RU').format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Выполнено</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Ожидание</Badge>;
      case 'failed':
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Отменено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionIcon = (txType: string, status: string) => {
    if (status !== 'completed') return <Clock className="h-4 w-4 text-muted-foreground" />;

    switch (txType) {
      case 'topup':
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case 'payment':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'refund':
        return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      default:
        return <Wallet className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Лицевой счёт
          </CardTitle>
          <CardDescription>Счёт не найден</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Лицевой счёт
            </CardTitle>
            <CardDescription>{entityName || (type === 'doctor' ? 'Врач' : 'Клиника')}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Обновить баланс">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-primary/15 via-primary/10 to-teal-500/10 p-6">
          <p className="mb-1 text-sm text-muted-foreground">Текущий баланс</p>
          <p className="text-3xl font-bold text-primary">
            {formatAmount(account.balance)} <span className="text-lg font-normal">UZS</span>
          </p>
        </div>

        <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Пополнить счёт
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Пополнение счёта</DialogTitle>
              <DialogDescription>Выберите сумму и способ оплаты</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Сумма пополнения (UZS)</Label>
                <Input
                  type="number"
                  placeholder="100 000"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  min={1000}
                  step={1000}
                />
                <div className="flex flex-wrap gap-2">
                  {[50000, 100000, 200000, 500000].map((preset) => (
                    <Button key={preset} variant="outline" size="sm" onClick={() => setAmount(preset.toString())}>
                      {formatAmount(preset)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Способ оплаты</Label>
                <div className="grid grid-cols-3 gap-3">
                  {paymentProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={`rounded-lg border-2 p-4 text-center transition-all ${
                        selectedProvider === provider.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img src={provider.logo} alt={provider.name} className="mx-auto mb-2 h-12 w-12 object-contain" />
                      <span className="text-sm font-medium">{provider.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleTopup}
                disabled={!amount || !selectedProvider || isTopupLoading || parseInt(amount) < 1000}
              >
                {isTopupLoading ? 'Обработка...' : `Оплатить ${amount ? formatAmount(parseInt(amount)) : '0'} UZS`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div>
          <h4 className="mb-3 font-medium">История операций</h4>
          <ScrollArea className="h-[250px]">
            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                        {getTransactionIcon(tx.transaction_type, tx.payment_status)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {tx.description || (tx.transaction_type === 'topup' ? 'Пополнение' : 'Оплата')}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: ru })}</span>
                          {tx.payment_provider && (
                            <Badge variant="outline" className="text-xs">
                              {tx.payment_provider.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-medium ${
                        tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? '+' : '-'}
                        {formatAmount(tx.amount)} UZS
                      </p>
                      {getStatusBadge(tx.payment_status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Wallet className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Нет операций</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>

      {account && (
        <PaymeTopupFlow
          open={isPaymeFlowOpen}
          onOpenChange={setIsPaymeFlowOpen}
          amount={parseInt(amount) || 0}
          accountId={account.id}
          onSuccess={() => {
            refresh();
            setAmount('');
            setSelectedProvider(null);
          }}
        />
      )}
    </Card>
  );
}
