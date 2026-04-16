import { useState } from 'react';
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
  Loader2
} from 'lucide-react';

interface ProfilePrivacySettingsProps {
  doctor: any;
}

interface PrivacySetting {
  key: string;
  icon: any;
  title: string;
  description: string;
  value: boolean;
}

export function ProfilePrivacySettings({ doctor }: ProfilePrivacySettingsProps) {
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState({
    is_visible: doctor?.is_visible ?? true,
    hide_contacts: doctor?.hide_contacts ?? false,
    moderation_reviews: doctor?.moderation_reviews ?? false,
  });

  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
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
      toast({ title: 'Настройки обновлены' });
      queryClient.invalidateQueries({ queryKey: ['crm-doctor-profile'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Ошибка', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
    onSettled: () => {
      setLoadingKey(null);
    },
  });

  const privacySettings: PrivacySetting[] = [
    {
      key: 'is_visible',
      icon: settings.is_visible ? Eye : EyeOff,
      title: 'Видимость профиля',
      description: 'Ваш профиль виден в поиске и каталоге врачей',
      value: settings.is_visible,
    },
    {
      key: 'hide_contacts',
      icon: Phone,
      title: 'Скрыть контакты',
      description: 'Телефон и email видны только после записи на приём',
      value: settings.hide_contacts,
    },
    {
      key: 'moderation_reviews',
      icon: MessageSquare,
      title: 'Модерация отзывов',
      description: 'Отзывы публикуются только после вашего одобрения',
      value: settings.moderation_reviews,
    },
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Настройки приватности
        </CardTitle>
        <CardDescription>
          Управляйте видимостью вашего профиля и контактной информации
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
            💡 Советы по приватности
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Скрытие контактов снижает спам, но может уменьшить конверсию</li>
            <li>• Модерация отзывов даёт контроль, но задерживает публикацию</li>
            <li>• Скрытый профиль не виден новым пациентам</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
