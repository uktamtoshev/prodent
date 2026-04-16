import { AccountantLayout } from '@/components/accountant/AccountantLayout';

export default function AccountantSalaries() {
  return (
    <AccountantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Зарплаты врачей</h1>
        <p className="text-muted-foreground">Расчёт и выплата зарплат</p>
      </div>
    </AccountantLayout>
  );
}
