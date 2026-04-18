import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Phone, MapPin, Clock } from "lucide-react";

export default function Contacts() {
  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Контакты — PRODENT" description="Свяжитесь с командой PRODENT. Адрес, телефон, email." />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Контакты</h1>
          <p className="text-muted-foreground mb-8">Свяжитесь с нами любым удобным способом</p>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Юридическое лицо</h3>
                    <p className="text-muted-foreground">ООО &laquo;PRODENT&raquo;</p>
                    <p className="text-muted-foreground text-sm mt-1">ИНН: --- (уточняется)</p>
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
                    <h3 className="font-semibold text-lg mb-1">Адрес</h3>
                    <p className="text-muted-foreground">Республика Узбекистан</p>
                    <p className="text-muted-foreground">г. Ташкент</p>
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
                    <h3 className="font-semibold text-lg mb-1">Телефон</h3>
                    <a href="tel:+998712000000" className="text-primary hover:underline">+998 71 200 00 00</a>
                    <p className="text-muted-foreground text-sm mt-1">Пн-Пт, 09:00 - 18:00</p>
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
                    <h3 className="font-semibold text-lg mb-1">Email</h3>
                    <a href="mailto:info@prodent.uz" className="text-primary hover:underline">info@prodent.uz</a><br />
                    <a href="mailto:support@prodent.uz" className="text-muted-foreground hover:underline text-sm">support@prodent.uz</a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 p-6 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Время работы поддержки</h3>
            </div>
            <p className="text-muted-foreground">
              Понедельник - Пятница: 09:00 - 18:00 (UZT, UTC+5)<br />
              Суббота: 10:00 - 15:00<br />
              Воскресенье: выходной
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
