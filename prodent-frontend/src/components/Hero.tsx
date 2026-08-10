import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, Sparkles, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");

  const handleSearch = () => {
    navigate(`/search?specialty=${specialty}&city=${city}`);
  };

  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 mesh-bg" />
      
      <div className="absolute top-20 right-[10%] w-72 h-72 bg-silk-jade/10 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-20 left-[5%] w-96 h-96 bg-desert-gold/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: "-2s" }} />
      <div className="absolute top-1/2 right-[20%] w-64 h-64 bg-tashkent-sky/8 rounded-full blur-3xl animate-blob" style={{ animationDelay: "-4s" }} />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-heading font-extrabold mb-6 leading-[1.1] tracking-tight opacity-0 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <span className="text-primary">PRO</span>
            <span className="text-foreground">DENT</span>
            <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl mt-4 font-bold text-muted-foreground">
              {t('hero.subtitle')}
            </span>
          </h1>

          <p 
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed opacity-0 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            {t('hero.description')}
          </p>

          <div 
            className="glass-strong p-3 sm:p-4 rounded-2xl sm:rounded-3xl max-w-3xl mx-auto mb-12 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger className="h-14 sm:h-16 flex-1 bg-background/50 border-0 text-base rounded-prodent">
                  <SelectValue placeholder={t('hero.selectSpecialty')} />
                </SelectTrigger>
                <SelectContent className="rounded-prodent">
                  <SelectItem value="therapist">{t('hero.specialties.therapist')}</SelectItem>
                  <SelectItem value="orthodontist">{t('hero.specialties.orthodontist')}</SelectItem>
                  <SelectItem value="surgeon">{t('hero.specialties.surgeon')}</SelectItem>
                  <SelectItem value="orthopedist">{t('hero.specialties.orthopedist')}</SelectItem>
                  <SelectItem value="periodontist">{t('hero.specialties.periodontist')}</SelectItem>
                  <SelectItem value="pediatric">{t('hero.specialties.pediatric')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="h-14 sm:h-16 flex-1 bg-background/50 border-0 text-base rounded-prodent">
                  <SelectValue placeholder={t('hero.selectCity')} />
                </SelectTrigger>
                <SelectContent className="rounded-prodent">
                  <SelectItem value="tashkent">{t('hero.cities.tashkent')}</SelectItem>
                  <SelectItem value="samarkand">{t('hero.cities.samarkand')}</SelectItem>
                  <SelectItem value="bukhara">{t('hero.cities.bukhara')}</SelectItem>
                  <SelectItem value="andijan">{t('hero.cities.andijan')}</SelectItem>
                  <SelectItem value="namangan">{t('hero.cities.namangan')}</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                size="lg" 
                variant="hero"
                className="h-14 sm:h-16 px-8 text-base font-bold rounded-prodent"
                onClick={handleSearch}
              >
                <Search className="w-5 h-5 mr-2" />
                {t('hero.searchButton')}
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-border/50">
              {[
                { key: 'implants', label: t('hero.quickLinks.implants') },
                { key: 'braces', label: t('hero.quickLinks.braces') },
                { key: 'whitening', label: t('hero.quickLinks.whitening') },
                { key: 'veneers', label: t('hero.quickLinks.veneers') },
                { key: 'caries', label: t('hero.quickLinks.caries') },
              ].map((tag) => (
                <button 
                  key={tag.key}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors duration-150"
                  onClick={() => navigate(`/search?service=${tag.key}`)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div 
            className="flex flex-wrap justify-center gap-6 sm:gap-10 opacity-0 animate-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            {/* Honest value props (was fabricated 500+/4.9/10K+ counts — misleading
                on a pilot with little real data). */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-prodent bg-gradient-jade flex items-center justify-center shadow-medium">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-lg font-heading font-bold">Проверенные</div>
                <div className="text-sm text-muted-foreground">врачи и клиники</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-prodent bg-gradient-gold flex items-center justify-center shadow-medium">
                <Star className="w-6 h-6 text-ink-gray" />
              </div>
              <div className="text-left">
                <div className="text-lg font-heading font-bold">Реальные</div>
                <div className="text-sm text-muted-foreground">отзывы пациентов</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-prodent bg-gradient-sky flex items-center justify-center shadow-medium">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-2xl font-heading font-bold">24/7</div>
                <div className="text-sm text-muted-foreground">онлайн-запись</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
