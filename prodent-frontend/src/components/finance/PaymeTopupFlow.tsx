import { useState } from 'react';
import { CreditCard, Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import paymeLogo from '@/assets/payments/payme-logo.png';

interface PaymeTopupFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  accountId: string;
  onSuccess: () => void;
}

type Step = 'card' | 'otp' | 'confirm' | 'success' | 'error';

export function PaymeTopupFlow({ open, onOpenChange, amount, accountId, onSuccess }: PaymeTopupFlowProps) {
  const [step, setStep] = useState<Step>('card');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpire, setCardExpire] = useState('');
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);

  // OTP
  const [otpCode, setOtpCode] = useState('');

  // Receipt
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpire = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2);
    }
    return digits;
  };

  const resetFlow = () => {
    setStep('card');
    setCardNumber('');
    setCardExpire('');
    setCardToken(null);
    setOtpCode('');
    setReceiptId(null);
    setTransactionId(null);
    setError(null);
    setMaskedPhone(null);
  };

  const handleClose = () => {
    resetFlow();
    onOpenChange(false);
  };

  // Step 1: Create card token
  const handleCardSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First create a pending transaction
      const { data: txData, error: txError } = await supabase.functions.invoke('payment-topup', {
        body: {
          account_id: accountId,
          amount,
          provider: 'payme',
        },
      });

      if (txError || !txData?.transaction_id) {
        throw new Error(txError?.message || 'Failed to create transaction');
      }

      setTransactionId(txData.transaction_id);

      // Call Payme cards.create
      const expireFormatted = cardExpire.replace(/\D/g, '');
      // Convert MM/YY to YYMM format
      const expireYYMM = expireFormatted.slice(2) + expireFormatted.slice(0, 2);

      const { data, error } = await supabase.functions.invoke('payme-subscribe', {
        body: {
          action: 'cards.create',
          card_number: cardNumber.replace(/\D/g, ''),
          card_expire: expireYYMM,
        },
      });

      if (error || !data?.card_token) {
        throw new Error(data?.error || error?.message || 'Failed to create card token');
      }

      setCardToken(data.card_token);
      setMaskedPhone(data.phone);
      setStep('otp');
      toast.info('SMS код отправлен на номер карты');

    } catch (err: any) {
      console.error('Card create error:', err);
      setError(err.message || 'Ошибка при обработке карты');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOtpSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('payme-subscribe', {
        body: {
          action: 'cards.verify',
          card_token: cardToken,
          otp_code: otpCode,
        },
      });

      if (error || !data?.verified) {
        throw new Error(data?.error || 'Неверный код подтверждения');
      }

      // Create receipt
      const { data: receiptData, error: receiptError } = await supabase.functions.invoke('payme-subscribe', {
        body: {
          action: 'receipts.create',
          amount,
          transaction_id: transactionId,
          account_id: accountId,
        },
      });

      if (receiptError || !receiptData?.receipt_id) {
        throw new Error(receiptData?.error || 'Failed to create receipt');
      }

      setReceiptId(receiptData.receipt_id);
      setStep('confirm');

    } catch (err: any) {
      console.error('OTP verify error:', err);
      setError(err.message || 'Ошибка верификации');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Pay receipt
  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('payme-subscribe', {
        body: {
          action: 'receipts.pay',
          receipt_id: receiptId,
          card_token: cardToken,
          transaction_id: transactionId,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Payment failed');
      }

      setStep('success');
      toast.success('Баланс успешно пополнен!');

      // Refresh parent data
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Ошибка оплаты');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <img src={paymeLogo} alt="Payme" className="h-10 object-contain" />
          </div>
          <DialogTitle className="text-center">
            {step === 'card' && 'Введите данные карты'}
            {step === 'otp' && 'Подтверждение SMS'}
            {step === 'confirm' && 'Подтверждение оплаты'}
            {step === 'success' && 'Оплата успешна'}
            {step === 'error' && 'Ошибка оплаты'}
          </DialogTitle>
          <DialogDescription className="text-center">
            Пополнение на {formatAmount(amount)} UZS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Step 1: Card Input */}
          {step === 'card' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">Номер карты</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="card-number"
                    placeholder="8600 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="pl-10"
                    maxLength={19}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-expire">Срок действия</Label>
                <Input
                  id="card-expire"
                  placeholder="MM/YY"
                  value={cardExpire}
                  onChange={(e) => setCardExpire(formatExpire(e.target.value))}
                  maxLength={5}
                  className="w-24"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Безопасное соединение
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCardSubmit}
                disabled={isLoading || cardNumber.replace(/\D/g, '').length < 16 || cardExpire.length < 5}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  'Продолжить'
                )}
              </Button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Код отправлен на номер {maskedPhone || 'привязанный к карте'}
              </p>

              <div className="space-y-2">
                <Label htmlFor="otp">Код из SMS</Label>
                <Input
                  id="otp"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Тестовый код: 666666
              </p>

              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('card')}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleOtpSubmit}
                  disabled={isLoading || otpCode.length < 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    'Подтвердить'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm Payment */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm text-muted-foreground mb-1">Сумма к оплате</p>
                <p className="text-3xl font-bold text-primary">
                  {formatAmount(amount)} <span className="text-lg font-normal">UZS</span>
                </p>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Карта: {cardNumber}</p>
                <p>• Назначение: Пополнение баланса</p>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Оплата...
                  </>
                ) : (
                  `Оплатить ${formatAmount(amount)} UZS`
                )}
              </Button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-lg">Оплата прошла успешно!</p>
                <p className="text-sm text-muted-foreground">
                  Баланс пополнен на {formatAmount(amount)} UZS
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-lg">Ошибка оплаты</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" onClick={resetFlow}>
                Попробовать снова
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
