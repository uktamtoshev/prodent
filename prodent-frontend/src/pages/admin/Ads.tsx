import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdsStats } from '@/components/admin/ads/AdsStats';
import { CampaignsList } from '@/components/admin/ads/CampaignsList';
import { CreateCampaignDialog } from '@/components/admin/ads/CreateCampaignDialog';
import { AdPackagesManager } from '@/components/admin/ads/AdPackagesManager';

export default function Ads() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Реклама и топ-позиции</h1>
            <p className="text-muted-foreground mt-2">Управление рекламными кампаниями врачей и клиник</p>
          </div>
          <CreateCampaignDialog />
        </div>

        <AdsStats />
        <AdPackagesManager />
        <CampaignsList />
      </div>
    </AdminLayout>
  );
}