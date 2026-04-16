import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Phone, Copy, Check, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ShareTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  publicToken: string;
  patientPhone?: string | null;
}

export function ShareTreatmentPlanDialog({
  open,
  onOpenChange,
  planName,
  publicToken,
  patientPhone,
}: ShareTreatmentPlanDialogProps) {
  const [phone, setPhone] = useState(patientPhone || "");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const publicUrl = `${window.location.origin}/treatment-plan/${publicToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    const message = encodeURIComponent(
      `Ваш план лечения "${planName}" готов. Просмотрите по ссылке:\n${publicUrl}`
    );
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleSMS = async () => {
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    if (!cleanPhone) {
      toast.error("Введите номер телефона");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          channel: "sms",
          phone: cleanPhone,
          message: `ProDent: Reja ko'rish / План лечения: ${publicUrl}`,
        },
      });

      if (error) throw error;
      toast.success("SMS отправлено");
      onOpenChange(false);
    } catch (err) {
      console.error("SMS error:", err);
      toast.error("Ошибка отправки SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Send className="w-5 h-5 text-primary" />
            Отправить план лечения
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Public Link */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Публичная ссылка</Label>
            <div className="flex gap-2">
              <Input
                value={publicUrl}
                readOnly
                className="text-xs bg-muted/50 font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(publicUrl, "_blank")}
                className="shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Номер телефона пациента</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              type="tel"
            />
          </div>

          {/* Send Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleWhatsApp}
              className="gap-2 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button
              onClick={handleSMS}
              disabled={!phone || sending}
              className="gap-2"
            >
              <Phone className="w-4 h-4" />
              {sending ? "Отправка..." : "SMS"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Пациент сможет просмотреть план лечения по ссылке без регистрации
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
