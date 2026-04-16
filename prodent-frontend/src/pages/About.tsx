import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  Users, 
  Stethoscope, 
  Building2, 
  ChevronRight, 
  CheckCircle2, 
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
  ChevronDown
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

const About = () => {
  const { user } = useAuth();
  const howToUseSteps = [
    {
      step: 1,
      title: "Регистрация",
      description: "Создайте аккаунт за несколько минут. Выберите тип профиля: пациент, врач или клиника."
    },
    {
      step: 2,
      title: "Поиск специалиста",
      description: "Используйте умный поиск для нахождения идеального врача по специализации, рейтингу и местоположению."
    },
    {
      step: 3,
      title: "Запись на приём",
      description: "Выберите удобное время и запишитесь на приём онлайн в несколько кликов."
    },
    {
      step: 4,
      title: "Получите уведомление",
      description: "Получите подтверждение и напоминание о визите через SMS, Email или Telegram."
    }
  ];

  const forPatients = [
    { icon: Search, title: "Удобный поиск врачей", description: "Находите специалистов по специализации, рейтингу и отзывам" },
    { icon: Calendar, title: "Онлайн-запись 24/7", description: "Записывайтесь на приём в любое время без звонков" },
    { icon: FileText, title: "Электронная карта", description: "Вся история лечения в одном месте, доступная всегда" },
    { icon: CreditCard, title: "Онлайн-оплата", description: "Удобная оплата через Payme, Click или Apelsin" },
    { icon: MessageSquare, title: "Чат с врачом", description: "Задавайте вопросы врачу напрямую через мессенджер" },
    { icon: Heart, title: "Семейные профили", description: "Управляйте записями всей семьи в одном аккаунте" }
  ];

  const forDoctors = [
    { icon: Calendar, title: "Управление расписанием", description: "Гибкое планирование рабочего времени и приёмов" },
    { icon: Users, title: "База пациентов", description: "Полная история пациентов с медицинскими картами" },
    { icon: Star, title: "Профессиональный профиль", description: "Витрина ваших достижений, портфолио и отзывов" },
    { icon: Award, title: "Рейтинг и отзывы", description: "Повышайте репутацию благодаря отзывам пациентов" },
    { icon: FileText, title: "Медицинские записи", description: "Удобное ведение электронной документации" },
    { icon: MessageSquare, title: "Коммуникация", description: "Общайтесь с пациентами и коллегами онлайн" }
  ];

  const forClinics = [
    { icon: BarChart3, title: "Аналитика и отчёты", description: "Полная статистика по работе клиники в реальном времени" },
    { icon: Users, title: "Управление персоналом", description: "Контроль расписания и эффективности врачей" },
    { icon: CreditCard, title: "Финансовый учёт", description: "Автоматический расчёт зарплат и выручки" },
    { icon: Settings, title: "CRM-система", description: "Полноценная система управления клиникой" },
    { icon: Shield, title: "Безопасность данных", description: "Надёжное хранение данных пациентов" },
    { icon: Clock, title: "Автоматизация", description: "Автоматические уведомления и напоминания" }
  ];

  const faqItems = [
    {
      question: "Как зарегистрироваться на портале?",
      answer: "Нажмите кнопку «Войти» в правом верхнем углу, затем выберите «Регистрация». Заполните форму с вашими данными и подтвердите email. Для врачей и клиник потребуется дополнительная верификация документов."
    },
    {
      question: "Как найти нужного врача?",
      answer: "Используйте страницу поиска, где можно фильтровать врачей по специализации, городу, рейтингу и цене. Также доступна карта с расположением клиник и врачей."
    },
    {
      question: "Как записаться на приём?",
      answer: "Откройте профиль понравившегося врача, выберите удобную дату и время из доступных слотов, подтвердите запись. Вы получите уведомление с подтверждением."
    },
    {
      question: "Можно ли отменить или перенести запись?",
      answer: "Да, вы можете отменить или перенести запись в личном кабинете в разделе «Мои записи» не позднее чем за 2 часа до приёма."
    },
    {
      question: "Как оплатить услуги?",
      answer: "Оплата доступна онлайн через Payme, Click или Apelsin, а также наличными или картой в клинике после приёма."
    },
    {
      question: "Безопасно ли хранятся мои данные?",
      answer: "Да, мы используем шифрование данных и соответствуем всем требованиям по защите персональных данных. Медицинская информация доступна только вам и вашему врачу."
    },
    {
      question: "Как врачу зарегистрироваться на портале?",
      answer: "Врач должен подать заявку через форму регистрации, прикрепить диплом, лицензию и сертификаты. После проверки модераторами профиль будет активирован."
    },
    {
      question: "Сколько стоит использование портала для врачей?",
      answer: "Базовое использование бесплатно. Для продвижения профиля доступны платные рекламные пакеты: топ дня, недели, месяца."
    },
    {
      question: "Как клинике подключиться к порталу?",
      answer: "Подайте заявку через форму регистрации клиники, предоставьте лицензию и учредительные документы. После верификации вы получите доступ к CRM-системе."
    },
    {
      question: "Какие возможности даёт CRM для клиник?",
      answer: "CRM включает: управление расписанием, базу пациентов, медицинские карты, финансовый учёт, управление персоналом, складской учёт, лабораторные заказы и аналитику."
    },
    {
      question: "Можно ли добавить нескольких врачей в одну клинику?",
      answer: "Да, клиника может добавлять неограниченное количество врачей. Каждый врач получит свой аккаунт с доступом к расписанию и пациентам."
    },
    {
      question: "Как работает система уведомлений?",
      answer: "Пациенты и врачи получают уведомления о записях, напоминания за 24 часа до приёма, информацию об изменениях через SMS, Email или Telegram."
    },
    {
      question: "Есть ли мобильное приложение?",
      answer: "Мобильное приложение находится в разработке. Пока вы можете использовать адаптивную веб-версию на любом устройстве."
    },
    {
      question: "Как оставить отзыв о враче?",
      answer: "После завершённого приёма вы сможете оставить отзыв и оценку в профиле врача. Отзывы проходят модерацию перед публикацией."
    },
    {
      question: "Можно ли вести записи для членов семьи?",
      answer: "Да, в личном кабинете есть раздел «Семья», где можно добавить профили детей и других членов семьи и управлять их записями."
    },
    {
      question: "Как врачу изменить своё расписание?",
      answer: "В личном кабинете врача есть раздел «Расписание», где можно настроить рабочие часы, добавить выходные и управлять доступными слотами."
    },
    {
      question: "Что такое рейтинг врача и как он формируется?",
      answer: "Рейтинг формируется на основе отзывов пациентов, количества успешных приёмов, качества профиля и активности на портале."
    },
    {
      question: "Как связаться с технической поддержкой?",
      answer: "Напишите нам на support@prodent.uz или позвоните по номеру +998 71 200 00 00. Поддержка работает с 9:00 до 21:00."
    },
    {
      question: "Работает ли портал в других городах Узбекистана?",
      answer: "Да, портал работает по всему Узбекистану, включая Ташкент, Самарканд, Бухару, Фергану, Наманган и другие города."
    },
    {
      question: "Как продвигать свой профиль врача или клиники?",
      answer: "Доступны рекламные пакеты: показ в топе поиска, баннерная реклама, выделенный профиль. Обратитесь к администрации для подключения рекламы."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-tashkent-sky bg-clip-text text-transparent">
              О проекте PRODENT
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              PRODENT — премиум портал стоматологов Центральной Азии. Мы объединяем пациентов, 
              врачей и клиники на единой платформе, делая стоматологическую помощь доступной и удобной.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/search">
                <Button size="lg" className="gap-2">
                  <Search className="w-5 h-5" />
                  Найти врача
                </Button>
              </Link>
              {!user && (
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Users className="w-5 h-5" />
                    Присоединиться
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
              <h2 className="text-3xl font-bold mb-4">Как пользоваться порталом</h2>
              <p className="text-muted-foreground">Простые шаги для начала работы</p>
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
                  <h2 className="text-2xl font-bold">Для пациентов</h2>
                  <p className="text-muted-foreground">Удобный доступ к качественной стоматологии</p>
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
                <h2 className="text-2xl font-bold">Для врачей</h2>
                <p className="text-muted-foreground">Развивайте практику и расширяйте аудиторию</p>
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
                  <h2 className="text-2xl font-bold">Для клиник</h2>
                  <p className="text-muted-foreground">Полноценная CRM-система для управления клиникой</p>
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
              <h2 className="text-3xl font-bold mb-4">Часто задаваемые вопросы</h2>
              <p className="text-muted-foreground">Ответы на популярные вопросы о работе портала</p>
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
              <p className="text-muted-foreground mb-4">
                Не нашли ответ на свой вопрос?
              </p>
              <Button variant="outline" size="lg" className="gap-2">
                <MessageSquare className="w-5 h-5" />
                Связаться с поддержкой
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
