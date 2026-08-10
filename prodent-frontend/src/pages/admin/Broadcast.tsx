import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/notifications';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Megaphone, Send, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Target audiences: 'all' or a single role (sent to every user holding it).
const AUDIENCES = ['all', 'patient', 'doctor', 'clinic_admin', 'seller', 'technician'] as const;

export default function Broadcast() {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<string>('all');

  const AUDIENCE_LABEL: Record<string, string> = {
    all: t('adminBroadcast.audAll'),
    patient: t('adminUsers.rolePatient'),
    doctor: t('adminUsers.roleDoctor'),
    clinic_admin: t('adminUsers.roleClinicAdmin'),
    seller: t('adminUsers.roleSeller'),
    technician: t('adminUsers.roleTechnician'),
  };

  const send = useMutation({
    mutationFn: () =>
      notificationsApi.broadcast({ title: title.trim(), message: message.trim(), role: role === 'all' ? undefined : role }),
    onSuccess: (res) => {
      toast.success(`${t('adminBroadcast.sent')} (${res.recipients})`);
      setTitle('');
      setMessage('');
      setRole('all');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t('admin.actionError')),
  });

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !send.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7" /> {t('adminBroadcast.title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('adminBroadcast.subtitle')}</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">{t('adminBroadcast.formTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bc-audience">{t('adminBroadcast.audience')}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="bc-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bc-title">{t('adminBroadcast.msgTitle')} *</Label>
              <Input
                id="bc-title"
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('adminBroadcast.msgTitlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bc-message">{t('adminBroadcast.msgBody')} *</Label>
              <Textarea
                id="bc-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('adminBroadcast.msgBodyPlaceholder')}
                rows={5}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => send.mutate()} disabled={!canSend} className="gap-2">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('adminBroadcast.send')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
