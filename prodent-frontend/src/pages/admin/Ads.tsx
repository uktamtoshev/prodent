import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdsStats } from '@/components/admin/ads/AdsStats';
import { CampaignsList } from '@/components/admin/ads/CampaignsList';
import { CreateCampaignDialog } from '@/components/admin/ads/CreateCampaignDialog';
import { AdPackagesManager } from '@/components/admin/ads/AdPackagesManager';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Ads() {
  const { t } = useLanguage();
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('adminAds.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('adminAds.subtitle')}</p>
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
