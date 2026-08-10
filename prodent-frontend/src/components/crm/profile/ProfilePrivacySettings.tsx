import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Shield,
  Eye,
  EyeOff,
  Phone,
  MessageSquare,
  Loader2,
  type LucideIcon
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Tables } from '@/integrations/supabase/types';

type DoctorProfile = Pick<Tables<'doctors'>, 'id' | 'is_visible' | 'hide_contacts' | 'moderation_reviews'>;
type PrivacySettingKey = 'is_visible' | 'hide_contacts' | 'moderation_reviews';
type PrivacySettingsState = Record<PrivacySettingKey, boolean>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface ProfilePrivacySettingsProps {
  doctor: DoctorProfile;
}

interface PrivacySetting {
  key: PrivacySettingKey;
  icon: LucideIcon;
  title: string;
  description: string;
  value: boolean;
}

export function ProfilePrivacySettings({ doctor }: ProfilePrivacySettingsProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<PrivacySettingsState>({
    is_visible: doctor?.is_visible ?? true,
    hide_contacts: doctor?.hide_contacts ?? false,
    moderation_reviews: doctor?.moderation_reviews ?? false,
  });

  const [loadingKey, setLoadingKey] = useState<PrivacySettingKey | null>(null);

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: PrivacySettingKey; value: boolean }) => {
      setLoadingKey(key);
      const { error } = await supabase
        .from('doctors')
        .update({ [key]: value })
        .eq('id', doctor.id);

      if (error) throw error;
      return { key, value };
    },
    onSuccess: ({ key, value }) => {
      setSettings(prev => ({ ...prev, [key]: value }));
      toast({ title: t('crmProfilePrivacy.settingsUpdated') });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
    },
    onError: (error: unknown) => {
      toast({
        title: t('crmProfilePrivacy.error'),
        description: getErrorMessage(error),
        variant: 'destructive'
      });
    },
    onSettled: () => {
      setLoadingKey(null);
    },
  });

  const privacySettings: PrivacySetting[] = useMemo(() => [
    {
      key: 'is_visible',
      icon: settings.is_visible ? Eye : EyeOff,
      title: t('crmProfilePrivacy.profileVisibility'),
      description: t('crmProfilePrivacy.profileVisibilityDesc'),
      value: settings.is_visible,
    },
    {
      key: 'hide_contacts',
      icon: Phone,
      title: t('crmProfilePrivacy.hideContacts'),
      description: t('crmProfilePrivacy.hideContactsDesc'),
      value: settings.hide_contacts,
    },
    {
      key: 'moderation_reviews',
      icon: MessageSquare,
      title: t('crmProfilePrivacy.moderationReviews'),
      description: t('crmProfilePrivacy.moderationReviewsDesc'),
      value: settings.moderation_reviews,
    },
  ], [settings, t]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <Shield className="w-5 h-5 text-primary" />
          {t('crmProfilePrivacy.privacySettings')}
        </CardTitle>
        <CardDescription>
          {t('crmProfilePrivacy.privacyDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {privacySettings.map((setting) => {
          const Icon = setting.icon;
          const isLoading = loadingKey === setting.key;

          return (
            <div
              key={setting.key}
              className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex gap-3">
                <div className="mt-0.5">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-base font-medium cursor-pointer">
                    {setting.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
              </div>
              <div className="relative">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <Switch
                    checked={setting.value}
                    onCheckedChange={(checked) =>
                      updateSetting.mutate({ key: setting.key, value: checked })
                    }
                    disabled={updateSetting.isPending}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Privacy Tips */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            💡 {t('crmProfilePrivacy.privacyTips')}
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• {t('crmProfilePrivacy.tip1')}</li>
            <li>• {t('crmProfilePrivacy.tip2')}</li>
            <li>• {t('crmProfilePrivacy.tip3')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
