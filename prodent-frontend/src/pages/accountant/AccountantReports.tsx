import { AccountantLayout } from '@/components/accountant/AccountantLayout';

export default function AccountantReports() {
  return (
    <AccountantLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Финансовые отчёты</h1>
        <p className="text-muted-foreground">Финансовая отчётность</p>
      </div>
    </AccountantLayout>
  );
}
