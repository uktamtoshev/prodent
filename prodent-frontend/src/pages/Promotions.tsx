import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Calendar, ArrowRight, Search, SlidersHorizontal, TrendingDown, MapPin, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageMeta } from "@/components/PageMeta";
import { PROMO_CATEGORY_SLUGS, PROMO_CATEGORY_LABEL_KEY, promoCategoryLabel } from "@/lib/promo-categories";
import { getPublicPromotionTarget, isPublicPromotionCurrent } from "@/lib/publicPromotion";

const Promotions = () => {
  const { t } = useLanguage();

  // Categories use the canonical slug taxonomy (promotions.category) shared with the
  // admin form — so admin-created promotions are actually filterable here.
  const categories = useMemo(
    () => [
      { value: "all", label: t("promotions.categories.all") },
      ...PROMO_CATEGORY_SLUGS.map((slug) => ({
        value: slug,
        label: t(PROMO_CATEGORY_LABEL_KEY[slug]),
      })),
    ],
    [t]
  );

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("discount");
  const [showFilters, setShowFilters] = useState(true);

  // Fetch promotions from database
  const { data: promotions = [], isLoading, error } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          clinics:clinic_id (name, city, district),
          doctors:doctor_id (
            id,
            specialty,
            profiles:user_id (full_name)
          )
        `)
        .eq('active', true)
        .gte('valid_until', new Date().toISOString().slice(0, 10))
        .order('discount', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Filter and sort promotions
  let filteredPromotions = promotions.filter((promo) => {
    const matchesCategory = selectedCategory === "all" || promo.category === selectedCategory;
    const matchesSearch = promo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         promo.description.toLowerCase().includes(searchQuery.toLowerCase());
    return isPublicPromotionCurrent(promo) && matchesCategory && matchesSearch;
  });

  // Sort promotions
  if (sortBy === "discount") {
    filteredPromotions = [...filteredPromotions].sort((a, b) => b.discount - a.discount);
  } else if (sortBy === "price-asc") {
    filteredPromotions = [...filteredPromotions].sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-desc") {
    filteredPromotions = [...filteredPromotions].sort((a, b) => b.price - a.price);
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <PageMeta
        title="Акции и скидки на стоматологию — PRODENT"
        description="Актуальные акции и скидки стоматологических клиник и врачей Узбекистана: гигиена, имплантация, ортодонтия, эстетика. Запишитесь по выгодной цене."
        canonical="https://prodent.uz/promotions"
      />
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {t("promotions.pageTitle")}{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                {t("promotions.pageTitleHighlight")}
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("promotions.pageSubtitle")}
            </p>
          </div>

          {/* Search and Sort Bar */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder={t("promotions.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px] h-12">
                  <SelectValue placeholder={t("promotions.sort")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">{t("promotions.sortByDiscount")}</SelectItem>
                  <SelectItem value="price-asc">{t("promotions.sortByPriceAsc")}</SelectItem>
                  <SelectItem value="price-desc">{t("promotions.sortByPriceDesc")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Category Filters */}
          {showFilters && (
            <div className="mb-8 animate-fade-in">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    {t("promotions.categoriesLabel")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Button
                        key={category.value}
                        variant={selectedCategory === category.value ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category.value)}
                        className="transition-all duration-300"
                        size="sm"
                      >
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {t("promotions.errorLoading")}
              </AlertDescription>
            </Alert>
          )}

          {/* Results Count */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>{t("promotions.foundLabel")} <span className="font-bold text-foreground">{filteredPromotions.length}</span></>
              )}
            </p>
            <Badge variant="secondary" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              {t("promotions.upToDiscount")}
            </Badge>
          </div>

          {/* Promotions Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                       <img
                         src={promo.image_url || '/promotions/cleaning.jpg'}
                         alt={promo.title}
                         loading="lazy"
                         decoding="async"
                         width={640}
                         height={384}
                         className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <Badge className="absolute top-4 right-4 bg-destructive text-white border-0 text-lg font-bold">
                        -{promo.discount}%
                      </Badge>
                      <div className="absolute top-4 left-4">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                          <Tag className="w-3 h-3 mr-1" />
                          {promoCategoryLabel(t, promo.category)}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                        {promo.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {promo.description}
                      </p>

                      {/* Price */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-2xl font-bold text-primary">{formatPrice(promo.price)}</span>
                          <span className="text-sm text-muted-foreground line-through">{formatPrice(promo.old_price)}</span>
                        </div>
                      </div>

                      {/* Provider info */}
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

                      {/* Valid until */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <Calendar className="w-4 h-4" />
                        <span>{t("promotions.validUntil")} {formatDate(promo.valid_until)}</span>
                      </div>

                      {/* CTA */}
                      <Link to={getPublicPromotionTarget(promo)}>
                        <Button className="w-full group/btn">
                          {t("promotions.book")}
                          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="max-w-md mx-auto">
                  <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold mb-2">{t("promotions.notFoundTitle")}</h3>
                  <p className="text-muted-foreground mb-6">
                    {t("promotions.notFoundHint")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                  >
                    {t("promotions.resetFiltersBtn")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Promotions;
