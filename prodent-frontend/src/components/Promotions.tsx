import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Calendar, ArrowRight, MapPin, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const Promotions = () => {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { key: "all", label: t('promotions.categories.all') },
    { key: "hygiene", label: t('promotions.categories.hygiene') },
    { key: "orthodontics", label: t('promotions.categories.orthodontics') },
    { key: "aesthetics", label: t('promotions.categories.aesthetics') },
    { key: "implants", label: t('promotions.categories.implants') },
    { key: "treatment", label: t('promotions.categories.treatment') },
    { key: "pediatric", label: t('promotions.categories.pediatric') },
    { key: "surgery", label: t('promotions.categories.surgery') },
    { key: "periodontics", label: t('promotions.categories.periodontics') },
    { key: "prosthetics", label: t('promotions.categories.prosthetics') },
  ];

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions-home'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          clinics:clinic_id (name, city),
          doctors:doctor_id (
            specialty,
            profiles:user_id (full_name)
          )
        `)
        .eq('active', true)
        .order('discount', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data || [];
    }
  });

  const filteredPromotions =
    selectedCategory === "all"
      ? promotions
      : promotions.filter((promo) => promo.category === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ' + t('search.sum');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <section className="py-20 bg-gradient-hero">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t('promotions.title')}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t('promotions.titleHighlight')}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('promotions.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <Button
              key={category.key}
              variant={selectedCategory === category.key ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.key)}
              className="transition-all duration-300"
            >
              {category.label}
            </Button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-8 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredPromotions.length > 0 ? (
            filteredPromotions.map((promo, index) => (
            <Card 
              key={promo.id}
              className="group overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-strong hover:-translate-y-1 cursor-pointer animate-scale-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-0">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={promo.image_url || '/promotions/cleaning.jpg'} 
                    alt={promo.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <Badge className="absolute top-4 right-4 bg-destructive text-white border-0 text-lg font-bold">
                    -{promo.discount}%
                  </Badge>
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      <Tag className="w-3 h-3 mr-1" />
                      {promo.category}
                    </Badge>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {promo.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {promo.description}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-bold text-primary">{formatPrice(promo.price)}</span>
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(promo.old_price)}</span>
                    </div>
                  </div>

                  <div className="mb-3 text-sm">
                    {promo.clinics && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{promo.clinics.name}</span>
                      </div>
                    )}
                    {promo.doctors && promo.doctors.profiles && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="truncate">{promo.doctors.profiles.full_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{t('promotions.validUntil')} {formatDate(promo.valid_until)}</span>
                  </div>

                  <Link to="/search">
                    <Button className="w-full group/btn">
                      {t('promotions.book')}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-xl text-muted-foreground">{t('promotions.noPromotions')}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <Link to="/promotions">
            <Button variant="outline" size="lg" className="group">
              {t('promotions.viewAll')}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Promotions;
