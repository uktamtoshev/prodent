import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, Mail, Phone, MapPin, Clock, Send, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Where lead submissions are routed. There is no public lead-capture endpoint
// (anonymous writes to /api/v1/data/** are rejected), so the working fallback is
// a pre-filled email to the sales inbox plus a direct Telegram contact — both
// real, actionable channels rather than a dead button.
const LEADS_EMAIL = "support@prodent.uz";
const LEADS_TELEGRAM = "https://t.me/prodent_uz";

export default function Contacts() {
  const { t } = useLanguage();

  const [form, setForm] = useState({ name: "", phone: "", clinic: "", message: "" });

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Укажите имя и телефон");
      return;
    }
    const subject = `Заявка с сайта PRODENT — ${form.name.trim()}`;
    const bodyLines = [
      `Имя: ${form.name.trim()}`,
      `Телефон: ${form.phone.trim()}`,
      form.clinic.trim() ? `Клиника: ${form.clinic.trim()}` : "",
      "",
      form.message.trim() || "(без сообщения)",
    ].filter(Boolean);
    const mailto = `mailto:${LEADS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join("\n")
    )}`;
    window.location.href = mailto;
    toast.success("Открываем почтовый клиент для отправки заявки");
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={t("contacts.pageTitle")} description={t("contacts.pageDescription")} />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">{t("contacts.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("contacts.subtitle")}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("contacts.legalEntityTitle")}</h3>
                    <p className="text-muted-foreground">{t("contacts.legalEntityName")}</p>
                    <p className="text-muted-foreground text-sm mt-1">{t("contacts.innLabel")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("contacts.addressTitle")}</h3>
                    <p className="text-muted-foreground">{t("contacts.country")}</p>
                    <p className="text-muted-foreground">{t("contacts.city")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("contacts.phoneTitle")}</h3>
                    <a href="tel:+998712000000" className="text-primary hover:underline">+998 71 200 00 00</a>
                    <p className="text-muted-foreground text-sm mt-1">{t("contacts.phoneHours")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("contacts.emailTitle")}</h3>
                    <a href="mailto:info@prodent.uz" className="text-primary hover:underline">info@prodent.uz</a><br />
                    <a href="mailto:support@prodent.uz" className="text-muted-foreground hover:underline text-sm">support@prodent.uz</a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lead-capture form — for clinics arriving from the Pricing /
              Enterprise CTA. Submits via a pre-filled email to the sales inbox
              (no public lead endpoint exists), with a direct Telegram fallback. */}
          <Card className="mt-8">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Оставить заявку</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-5">
                Заполните форму — мы свяжемся с вами в рабочее время.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-name">Имя *</Label>
                    <Input
                      id="lead-name"
                      value={form.name}
                      onChange={handleChange("name")}
                      placeholder="Ваше имя"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-phone">Телефон *</Label>
                    <Input
                      id="lead-phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange("phone")}
                      placeholder="+998 ___ __ __"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-clinic">Клиника</Label>
                  <Input
                    id="lead-clinic"
                    value={form.clinic}
                    onChange={handleChange("clinic")}
                    placeholder="Название клиники (необязательно)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-message">Сообщение</Label>
                  <Textarea
                    id="lead-message"
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder="Чем мы можем помочь?"
                    rows={4}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="rounded-full">
                    <Send className="w-4 h-4 mr-2" />
                    Отправить заявку
                  </Button>
                  <a href={LEADS_TELEGRAM} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="outline" className="rounded-full w-full sm:w-auto">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Написать в Telegram
                    </Button>
                  </a>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 p-6 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{t("contacts.supportTitle")}</h3>
            </div>
            <p className="text-muted-foreground">
              {t("contacts.supportMonFri")}<br />
              {t("contacts.supportSat")}<br />
              {t("contacts.supportSun")}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
