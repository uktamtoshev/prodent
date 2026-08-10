import { Clock, Shield, Star, Video, Calendar, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Features = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: Clock,
      title: t('features.booking.title'),
      description: t('features.booking.description'),
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Shield,
      title: t('features.verified.title'),
      description: t('features.verified.description'),
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: Star,
      title: t('features.reviews.title'),
      description: t('features.reviews.description'),
      gradient: "from-amber-500 to-orange-500",
    },
    {
      icon: Video,
      title: t('features.video.title'),
      description: t('features.video.description'),
      gradient: "from-pink-500 to-rose-500",
    },
    {
      icon: Calendar,
      title: t('features.reminders.title'),
      description: t('features.reminders.description'),
      gradient: "from-violet-500 to-purple-500",
    },
    {
      icon: Award,
      title: t('features.premium.title'),
      description: t('features.premium.description'),
      gradient: "from-primary to-accent",
    },
  ];

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="absolute inset-0 mesh-bg opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <span 
            className="inline-block text-sm font-semibold text-primary mb-4 opacity-0 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            {t('features.badge')}
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 opacity-0 animate-fade-in [overflow-wrap:anywhere]"
            style={{ animationDelay: "0.2s" }}
          >
            {t('features.title')}{" "}
            <span className="text-gradient">{t('features.brandName')}</span>
          </h2>
          <p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto opacity-0 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group relative p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-500 hover:shadow-medium opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
