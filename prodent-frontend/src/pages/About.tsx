import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Users,
  Stethoscope,
  Building2,
  ChevronRight,
  Calendar,
  FileText,
  CreditCard,
  MessageSquare,
  Star,
  Shield,
  Clock,
  Search,
  Heart,
  Award,
  BarChart3,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageMeta } from "@/components/PageMeta";

const About = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const howToUseSteps = [
    { step: 1, title: t("about.step1Title"), description: t("about.step1Desc") },
    { step: 2, title: t("about.step2Title"), description: t("about.step2Desc") },
    { step: 3, title: t("about.step3Title"), description: t("about.step3Desc") },
    { step: 4, title: t("about.step4Title"), description: t("about.step4Desc") },
  ];

  const forPatients = [
    { icon: Search, title: t("about.ptSearchTitle"), description: t("about.ptSearchDesc") },
    { icon: Calendar, title: t("about.ptBookTitle"), description: t("about.ptBookDesc") },
    { icon: FileText, title: t("about.ptCardTitle"), description: t("about.ptCardDesc") },
    { icon: CreditCard, title: t("about.ptPayTitle"), description: t("about.ptPayDesc") },
    { icon: MessageSquare, title: t("about.ptChatTitle"), description: t("about.ptChatDesc") },
    { icon: Heart, title: t("about.ptFamilyTitle"), description: t("about.ptFamilyDesc") },
  ];

  const forDoctors = [
    { icon: Calendar, title: t("about.drScheduleTitle"), description: t("about.drScheduleDesc") },
    { icon: Users, title: t("about.drBaseTitle"), description: t("about.drBaseDesc") },
    { icon: Star, title: t("about.drProfileTitle"), description: t("about.drProfileDesc") },
    { icon: Award, title: t("about.drRatingTitle"), description: t("about.drRatingDesc") },
    { icon: FileText, title: t("about.drRecordsTitle"), description: t("about.drRecordsDesc") },
    { icon: MessageSquare, title: t("about.drCommTitle"), description: t("about.drCommDesc") },
  ];

  const forClinics = [
    { icon: BarChart3, title: t("about.clAnalyticsTitle"), description: t("about.clAnalyticsDesc") },
    { icon: Users, title: t("about.clStaffTitle"), description: t("about.clStaffDesc") },
    { icon: CreditCard, title: t("about.clFinanceTitle"), description: t("about.clFinanceDesc") },
    { icon: Settings, title: t("about.clCrmTitle"), description: t("about.clCrmDesc") },
    { icon: Shield, title: t("about.clSecurityTitle"), description: t("about.clSecurityDesc") },
    { icon: Clock, title: t("about.clAutomationTitle"), description: t("about.clAutomationDesc") },
  ];

  // FAQ items: 20 question/answer pairs sourced from t('about.faqNQ' / 'faqNA').
  // Other languages fall back to Russian until translated separately.
  const faqItems = Array.from({ length: 20 }, (_, i) => ({
    question: t(`about.faq${i + 1}Q`),
    answer: t(`about.faq${i + 1}A`),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="О проекте — PRODENT"
        description="PRODENT — премиум-портал стоматологов Центральной Азии. Узнайте, как пациенты, врачи и клиники используют платформу: поиск, онлайн-запись, медкарты и CRM."
        canonical="https://prodent.uz/about"
      />
      <Header />

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-tashkent-sky bg-clip-text text-transparent">
              {t("about.heroTitle")}
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              {t("about.heroDescription")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/search">
                <Button size="lg" className="gap-2">
                  <Search className="w-5 h-5" />
                  {t("about.findDoctor")}
                </Button>
              </Link>
              {!user && (
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Users className="w-5 h-5" />
                    {t("about.join")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* How to Use */}
        <section className="container mx-auto px-4 mb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t("about.howToUseTitle")}</h2>
              <p className="text-muted-foreground">{t("about.howToUseSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {howToUseSteps.map((item, index) => (
                <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <span className="text-xl font-bold text-primary">{item.step}</span>
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                  {index < howToUseSteps.length - 1 && (
                    <ChevronRight className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 text-muted-foreground/30 z-10" />
                  )}
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* For Patients */}
        <section className="bg-primary/5 py-16 mb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{t("about.forPatientsTitle")}</h2>
                  <p className="text-muted-foreground">{t("about.forPatientsSubtitle")}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {forPatients.map((item, index) => (
                  <Card key={index} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium mb-1">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* For Doctors */}
        <section className="container mx-auto px-4 mb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-tashkent-sky/10 flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-tashkent-sky" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{t("about.forDoctorsTitle")}</h2>
                <p className="text-muted-foreground">{t("about.forDoctorsSubtitle")}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {forDoctors.map((item, index) => (
                <Card key={index} className="group hover:shadow-md transition-shadow border-tashkent-sky/20">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-tashkent-sky/10 flex items-center justify-center shrink-0 group-hover:bg-tashkent-sky/20 transition-colors">
                        <item.icon className="w-5 h-5 text-tashkent-sky" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* For Clinics */}
        <section className="bg-muted/50 py-16 mb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-oriental-emerald/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-oriental-emerald" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{t("about.forClinicsTitle")}</h2>
                  <p className="text-muted-foreground">{t("about.forClinicsSubtitle")}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {forClinics.map((item, index) => (
                  <Card key={index} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-oriental-emerald/10 flex items-center justify-center shrink-0 group-hover:bg-oriental-emerald/20 transition-colors">
                          <item.icon className="w-5 h-5 text-oriental-emerald" />
                        </div>
                        <div>
                          <h3 className="font-medium mb-1">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">{t("about.faqTitle")}</h2>
              <p className="text-muted-foreground">{t("about.faqSubtitle")}</p>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border rounded-xl px-6 data-[state=open]:bg-muted/50"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-5">
                    <span className="font-medium pr-4">{item.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-12 text-center">
              <p className="text-muted-foreground mb-4">{t("about.noAnswer")}</p>
              <Button variant="outline" size="lg" className="gap-2">
                <MessageSquare className="w-5 h-5" />
                {t("about.contactSupport")}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
