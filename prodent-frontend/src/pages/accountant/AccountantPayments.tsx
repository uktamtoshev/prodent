import { AccountantLayout } from '@/components/accountant/AccountantLayout';

export default function AccountantPayments() {
  return (
    <AccountantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Оплаты</h1>
        <p className="text-muted-foreground">Учёт платежей</p>
      </div>
    </AccountantLayout>
  );
}
