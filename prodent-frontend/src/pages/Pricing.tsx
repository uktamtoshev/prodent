import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X, Sparkles, ArrowRight, Zap, Crown, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    nameRu: "Бесплатный",
    price: 0,
    period: "",
    description: "Для знакомства с платформой",
    icon: Zap,
    color: "border-border",
    popular: false,
    features: [
      { text: "10 записей в месяц", included: true },
      { text: "50 пациентов", included: true },
      { text: "Базовый профиль", included: true },
      { text: "Онлайн-запись", included: true },
      { text: "Аналитика", included: false },
      { text: "Приоритет в поиске", included: false },
      { text: "Лаборатория", included: false },
      { text: "Финансы и касса", included: false },
      { text: "Склад", included: false },
      { text: "API-доступ", included: false },
    ],
  },
  {
    name: "Basic",
    nameRu: "Базовый",
    price: 99000,
    period: "/мес",
    description: "Для начинающих врачей и небольших клиник",
    icon: Sparkles,
    color: "border-primary/50",
    popular: false,
    features: [
      { text: "100 записей в месяц", included: true },
      { text: "500 пациентов", included: true },
      { text: "Расширенный профиль", included: true },
      { text: "Онлайн-запись", included: true },
      { text: "Аналитика и отчёты", included: true },
      { text: "Приоритет в поиске", included: false },
      { text: "Лаборатория", included: false },
      { text: "Финансы и касса", included: false },
      { text: "Склад", included: false },
      { text: "API-доступ", included: false },
    ],
  },
  {
    name: "Pro",
    nameRu: "Профессиональный",
    price: 249000,
    period: "/мес",
    description: "Для активных врачей и клиник среднего размера",
    icon: Crown,
    color: "border-primary ring-2 ring-primary/20",
    popular: true,
    features: [
      { text: "Безлимит записей", included: true },
      { text: "2 000 пациентов", included: true },
      { text: "Премиум-профиль", included: true },
      { text: "Онлайн-запись", included: true },
      { text: "Аналитика и отчёты", included: true },
      { text: "Приоритет в поиске", included: true },
      { text: "Лаборатория", included: true },
      { text: "Финансы и касса", included: true },
      { text: "Склад", included: false },
      { text: "API-доступ", included: false },
    ],
  },
  {
    name: "Enterprise",
    nameRu: "Корпоративный",
    price: 499000,
    period: "/мес",
    description: "Для сетевых клиник и крупных практик",
    icon: Building2,
    color: "border-border",
    popular: false,
    features: [
      { text: "Безлимит записей", included: true },
      { text: "Безлимит пациентов", included: true },
      { text: "Премиум-профиль", included: true },
      { text: "Онлайн-запись", included: true },
      { text: "Расширенная аналитика", included: true },
      { text: "Приоритет в поиске", included: true },
      { text: "Лаборатория", included: true },
      { text: "Финансы и касса", included: true },
      { text: "Склад и инвентарь", included: true },
      { text: "API-доступ", included: true },
    ],
  },
];

function formatPrice(price: number) {
  if (price === 0) return "Бесплатно";
  return new Intl.NumberFormat("ru-RU").format(price);
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Тарифы — PRODENT"
        description="Тарифные планы PRODENT для врачей и клиник. От бесплатного до корпоративного. CRM, аналитика, онлайн-запись."
        canonical="https://prodent.uz/pricing"
      />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Тарифы
            </span>
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Выберите план для вашей практики
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Начните бесплатно. Масштабируйтесь когда будете готовы. Без скрытых платежей.
            </p>
          </div>

          {/* Plans grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.name}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                    plan.color
                  )}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                      Популярный
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                      plan.popular ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold">{plan.nameRu}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-3">
                      {plan.price === 0 ? (
                        <span className="text-3xl font-bold">Бесплатно</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                          <span className="text-muted-foreground ml-1">UZS{plan.period}</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-sm">
                          {feat.included ? (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={cn(!feat.included && "text-muted-foreground/60")}>
                            {feat.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/auth">
                      <Button
                        className={cn(
                          "w-full",
                          plan.popular
                            ? "bg-primary hover:bg-primary/90"
                            : "variant-outline"
                        )}
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {plan.price === 0 ? "Начать бесплатно" : "Подключить"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-heading font-bold text-center mb-8">Частые вопросы</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Могу ли я сменить план в любой момент?",
                  a: "Да, вы можете повысить план в любое время. Разница в стоимости будет списана пропорционально оставшимся дням текущего периода."
                },
                {
                  q: "Что происходит при достижении лимита записей?",
                  a: "Вы получите уведомление при приближении к лимиту (80%). После исчерпания лимита новые записи будут заблокированы до следующего месяца или повышения плана."
                },
                {
                  q: "Есть ли пробный период для платных планов?",
                  a: "Бесплатный план доступен без ограничений по времени. Для платных планов мы предлагаем 14-дневный пробный период с полным функционалом."
                },
                {
                  q: "Как работает оплата?",
                  a: "Оплата производится через виртуальный баланс в личном кабинете. Пополнить баланс можно через Payme, Click или Uzum Bank."
                },
                {
                  q: "Чем Pro отличается от Enterprise?",
                  a: "Enterprise включает безлимит пациентов (vs 2000 в Pro), модуль склада и инвентаря, и API-доступ для интеграции с внешними системами. Идеален для сетевых клиник."
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="text-center mt-16 p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
            <h2 className="text-2xl font-heading font-bold mb-2">Нужен индивидуальный план?</h2>
            <p className="text-muted-foreground mb-6">Для сетевых клиник с 5+ филиалами мы предлагаем специальные условия.</p>
            <Link to="/contacts">
              <Button size="lg" className="rounded-full">
                Связаться с нами
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
