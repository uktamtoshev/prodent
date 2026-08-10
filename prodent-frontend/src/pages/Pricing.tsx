import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check, X, Sparkles, ArrowRight, Zap, Crown, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Pricing() {
  const { t } = useLanguage();

  // Plan definitions — all user-visible text comes from t('pricing.*').
  // The icon, color, popular flag and price are language-independent.
  //
  // `slug` MUST match subscription_plans.slug and the backend Clinic.SubscriptionPlan
  // enum {FREE, BASIC, PREMIUM, ENTERPRISE} (uppercase) so that the subscribe flow
  // can resolve the plan the visitor saw. The mid tier was historically called "Pro"
  // here while the DB/enum use "PREMIUM" (renamed in migration V38) — keeping the old
  // slug meant a checkout could never match the active plan. Prices mirror the V2 seed.
  const plans = [
    {
      key: "free",
      slug: "FREE",
      nameKey: "pricing.planFree",
      descKey: "pricing.planFreeDesc",
      price: 0,
      period: "",
      icon: Zap,
      color: "border-border",
      popular: false,
      features: [
        { textKey: "pricing.feat10Appointments", included: true },
        { textKey: "pricing.feat50Patients", included: true },
        { textKey: "pricing.featBasicProfile", included: true },
        { textKey: "pricing.featOnlineBooking", included: true },
        { textKey: "pricing.featAnalytics", included: false },
        { textKey: "pricing.featSearchPriority", included: false },
        { textKey: "pricing.featLab", included: false },
        { textKey: "pricing.featFinance", included: false },
        { textKey: "pricing.featInventory", included: false },
        { textKey: "pricing.featApi", included: false },
      ],
    },
    {
      key: "basic",
      slug: "BASIC",
      nameKey: "pricing.planBasic",
      descKey: "pricing.planBasicDesc",
      price: 99000,
      period: t("pricing.perMonth"),
      icon: Sparkles,
      color: "border-primary/50",
      popular: false,
      features: [
        { textKey: "pricing.feat100Appointments", included: true },
        { textKey: "pricing.feat500Patients", included: true },
        { textKey: "pricing.featExtendedProfile", included: true },
        { textKey: "pricing.featOnlineBooking", included: true },
        { textKey: "pricing.featAnalyticsReports", included: true },
        { textKey: "pricing.featSearchPriority", included: false },
        { textKey: "pricing.featLab", included: false },
        { textKey: "pricing.featFinance", included: false },
        { textKey: "pricing.featInventory", included: false },
        { textKey: "pricing.featApi", included: false },
      ],
    },
    {
      // Mid tier. Backend slug/enum is PREMIUM (V38 renamed the legacy "PRO").
      // The localized display label stays pricing.planPro to avoid touching the
      // shared i18n dictionary, but the slug must be PREMIUM for the subscribe flow.
      key: "premium",
      slug: "PREMIUM",
      nameKey: "pricing.planPro",
      descKey: "pricing.planProDesc",
      price: 249000,
      period: t("pricing.perMonth"),
      icon: Crown,
      color: "border-primary ring-2 ring-primary/20",
      popular: true,
      features: [
        { textKey: "pricing.featUnlimitedAppts", included: true },
        // DB has max_patients = -1 (unlimited) for this tier — was wrongly "2 000".
        { textKey: "pricing.featUnlimitedPatients", included: true },
        { textKey: "pricing.featPremiumProfile", included: true },
        { textKey: "pricing.featOnlineBooking", included: true },
        { textKey: "pricing.featAnalyticsReports", included: true },
        { textKey: "pricing.featSearchPriority", included: true },
        { textKey: "pricing.featLab", included: true },
        { textKey: "pricing.featFinance", included: true },
        { textKey: "pricing.featInventory", included: false },
        { textKey: "pricing.featApi", included: false },
      ],
    },
    {
      key: "enterprise",
      slug: "ENTERPRISE",
      nameKey: "pricing.planEnterprise",
      descKey: "pricing.planEnterpriseDesc",
      price: 499000,
      period: t("pricing.perMonth"),
      icon: Building2,
      color: "border-border",
      popular: false,
      features: [
        { textKey: "pricing.featUnlimitedAppts", included: true },
        { textKey: "pricing.featUnlimitedPatients", included: true },
        { textKey: "pricing.featPremiumProfile", included: true },
        { textKey: "pricing.featOnlineBooking", included: true },
        { textKey: "pricing.featExtendedAnalytics", included: true },
        { textKey: "pricing.featSearchPriority", included: true },
        { textKey: "pricing.featLab", included: true },
        { textKey: "pricing.featFinance", included: true },
        { textKey: "pricing.featInventoryFull", included: true },
        { textKey: "pricing.featApi", included: true },
      ],
    },
  ];

  function formatPrice(price: number) {
    if (price === 0) return t("pricing.free");
    return new Intl.NumberFormat("ru-RU").format(price);
  }

  const faqs = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`pricing.faq${n}Q`),
    a: t(`pricing.faq${n}A`),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title={t("pricing.metaTitle")}
        description={t("pricing.metaDescription")}
        canonical="https://prodent.uz/pricing"
      />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              {t("pricing.badge")}
            </span>
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              {t("pricing.heroTitle")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t("pricing.heroSubtitle")}
            </p>
          </div>

          {/* Plans grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.slug}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                    plan.color
                  )}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                      {t("pricing.popular")}
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                        plan.popular ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold">{t(plan.nameKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(plan.descKey)}</p>
                    <div className="mt-3">
                      {plan.price === 0 ? (
                        <span className="text-3xl font-bold">{t("pricing.free")}</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                          <span className="text-muted-foreground ml-1">сум{plan.period}</span>
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
                            {t(feat.textKey)}
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
                        {plan.price === 0 ? t("pricing.startFree") : t("pricing.connect")}
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
            <h2 className="text-2xl font-heading font-bold text-center mb-8">
              {t("pricing.faqTitle")}
            </h2>
            <div className="space-y-4">
              {faqs.map(({ q, a }, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="text-center mt-16 p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
            <h2 className="text-2xl font-heading font-bold mb-2">
              {t("pricing.customPlanTitle")}
            </h2>
            <p className="text-muted-foreground mb-6">{t("pricing.customPlanDescription")}</p>
            <Link to="/contacts">
              <Button size="lg" className="rounded-full">
                {t("pricing.contactUs")}
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
