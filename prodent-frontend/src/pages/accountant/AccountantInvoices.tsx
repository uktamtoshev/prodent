import { AccountantLayout } from '@/components/accountant/AccountantLayout';

export default function AccountantInvoices() {
  return (
    <AccountantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Счета</h1>
        <p className="text-muted-foreground">Управление счетами</p>
      </div>
    </AccountantLayout>
  );
}
