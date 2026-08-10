import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { uzLatinToCyrl } from "@/lib/uzbek-transliterate";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Calendar, Clock, ArrowRight, BookOpen, Newspaper, TrendingUp, Eye, Heart, Share2 } from "lucide-react";
import { formatCount } from "@/lib/engagement";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageMeta } from "@/components/PageMeta";

import dentalGeneral from "@/assets/articles/dental-general.jpg";
import dentalWhitening from "@/assets/articles/dental-whitening.jpg";
import dentalKids from "@/assets/articles/dental-kids.jpg";
import dentalImplant from "@/assets/articles/dental-implant.jpg";
import dentalHygiene from "@/assets/articles/dental-hygiene.jpg";
import dentalBraces from "@/assets/articles/dental-braces.jpg";
import dentalNamanganClinic from "@/assets/articles/dental-namangan-clinic.jpg";
import dentalEmergencyPain from "@/assets/articles/dental-emergency-pain.jpg";
import dentalLaserTech from "@/assets/articles/dental-laser-tech.jpg";
import dentalFissureSealant from "@/assets/articles/dental-fissure-sealant.jpg";
import dentalBodyHealth from "@/assets/articles/dental-body-health.jpg";
import dentalDigital3d from "@/assets/articles/dental-digital-3d.jpg";
import dentalBridge from "@/assets/articles/dental-bridge.jpg";
import dentalRetainer from "@/assets/articles/dental-retainer.jpg";
import dentalCystXray from "@/assets/articles/dental-cyst-xray.jpg";
import dentalFluoride from "@/assets/articles/dental-fluoride.jpg";
import dentalImmediateImplant from "@/assets/articles/dental-immediate-implant.jpg";
import dentalBoneGraft from "@/assets/articles/dental-bone-graft.jpg";
import dentalAllOn4 from "@/assets/articles/dental-all-on-4.jpg";
import dentalElderly from "@/assets/articles/dental-elderly.jpg";
import dentalSensitivity from "@/assets/articles/dental-sensitivity.jpg";
import dentalBukharaClinic from "@/assets/articles/dental-bukhara-clinic.jpg";
import dentalInlay from "@/assets/articles/dental-inlay.jpg";
import dentalMouthUlcer from "@/assets/articles/dental-mouth-ulcer.jpg";
import dentalNightGuard from "@/assets/articles/dental-night-guard.jpg";
import dentalSmoker from "@/assets/articles/dental-smoker.jpg";

const articleCovers: Record<string, string> = {
  'stomatologiya-namangan': dentalNamanganClinic,
  'ostraya-zubnaya-bol-nochyu': dentalEmergencyPain,
  'lazer-v-stomatologii': dentalLaserTech,
  'germetizaciya-fissur': dentalFissureSealant,
  'zuby-i-obshhee-zdorove': dentalBodyHealth,
  'cifrovaya-stomatologiya': dentalDigital3d,
  'mosty-na-zuby': dentalBridge,
  'reteynery-posle-breketov': dentalRetainer,
  'kista-zuba': dentalCystXray,
  'ftorirovanie-zubov': dentalFluoride,
  'odnomomentnaya-implantaciya': dentalImmediateImplant,
  'kostnaya-plastika': dentalBoneGraft,
  'protezirovanie-all-on-4': dentalAllOn4,
  'stomatologiya-dlya-pozhilyh': dentalElderly,
  'chuvstvitelnost-zubov': dentalSensitivity,
  'stomatologiya-buhara': dentalBukharaClinic,
  'zubnye-vkladki': dentalInlay,
  'yazvy-vo-rtu': dentalMouthUlcer,
  'nochnye-kapy-bruksizm': dentalNightGuard,
  'zuby-kurilshhika': dentalSmoker,
};

const defaultCovers = [
  dentalGeneral,
  dentalWhitening,
  dentalKids,
  dentalImplant,
  dentalHygiene,
  dentalBraces,
];

interface BlogPostResponse {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  tags?: string[];
  viewCount?: number;
  likesCount?: number;
  sharesCount?: number;
}

const Articles = () => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // DB has articles in ru/uz/en; the LanguageContext also has uz_cyrl/kz/kg/tj.
  // For uz_cyrl we load uz (latin) and transliterate on the fly. For other
  // languages without content (kz/kg/tj) we fall back to ru.
  const articleLang =
    language === 'uz' || language === 'uz_cyrl' ? 'uz'
    : language === 'ru' ? 'ru'
    : 'ru';
  const needCyrl = language === 'uz_cyrl';

  const { data: articles, isLoading } = useQuery({
    queryKey: ["public-articles", articleLang, needCyrl],
    queryFn: async () => {
      const res = await fetch(`/api/v1/public/blog?lang=${articleLang}&size=50`);
      if (!res.ok) throw new Error(`Failed to load articles: ${res.status}`);
      const json = await res.json();
      const rows = (json.content ?? []) as BlogPostResponse[];
      return rows.map((p) => ({
        id: p.id,
        title: needCyrl ? uzLatinToCyrl(p.title) : p.title,
        slug: p.slug,
        excerpt: needCyrl ? uzLatinToCyrl(p.excerpt ?? "") : p.excerpt,
        content: needCyrl ? uzLatinToCyrl(p.content ?? "") : p.content,
        cover_url: p.coverUrl,
        published_at: p.publishedAt,
        meta_keywords: needCyrl
          ? (p.tags ?? []).map((t: string) => uzLatinToCyrl(t))
          : p.tags ?? [],
        view_count: p.viewCount ?? 0,
        likes_count: p.likesCount ?? 0,
        shares_count: p.sharesCount ?? 0,
      }));
    },
  });

  const categories = articles?.reduce((acc: string[], article) => {
    if (article.meta_keywords) {
      article.meta_keywords.forEach((k: string) => {
        if (!acc.includes(k) && acc.length < 8) {
          acc.push(k);
        }
      });
    }
    return acc;
  }, []) || [];

  const filteredArticles = articles?.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.meta_keywords?.some((k: string) =>
        k.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesCategory = !selectedCategory || 
      article.meta_keywords?.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const estimateReadTime = (content: string | null) => {
    if (!content) return 3;
    const words = content.split(/\s+/).length;
    return Math.max(3, Math.ceil(words / 200));
  };

  const getArticleCover = (article: { slug: string; cover_url?: string | null }, index: number) => {
    // Prefer the cover_url stored on the row (e.g. /blog-covers/<slug>.svg
    // served by the backend). Fall back to the legacy bundled JPGs.
    if (article.cover_url) return article.cover_url;
    return articleCovers[article.slug] || defaultCovers[index % defaultCovers.length];
  };

  const featuredArticle = filteredArticles?.[0];
  const regularArticles = filteredArticles?.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Блог о стоматологии — PRODENT"
        description="Полезные статьи о стоматологии: лечение, гигиена, имплантация, детская стоматология и здоровье зубов. Советы экспертов PRODENT."
        canonical="https://prodent.uz/articles"
      />
      <Header />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16 md:py-24">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6 animate-fade-in">
                <Newspaper className="h-4 w-4" />
                <span className="text-sm font-medium">{t('articles.subtitle')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-in-up">
                {t('articles.heroTitle')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in-up">
                {t('articles.heroSubtitle')}
              </p>

              <div className="max-w-xl mx-auto animate-fade-in-up">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder={t('common.search') + "..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-14 text-lg rounded-2xl border-border/50 bg-background/80 backdrop-blur-sm focus:border-primary shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 -mt-6 relative z-20">
          <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4 flex flex-wrap items-center gap-2 justify-center">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/90 transition-colors"
              onClick={() => setSelectedCategory(null)}
            >
              {t('articles.categories.all')}
            </Badge>
            {categories.slice(0, 7).map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <Card key={i} className="animate-pulse overflow-hidden">
                  <div className="h-56 bg-muted" />
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-24 mb-3" />
                    <div className="h-6 bg-muted rounded w-full mb-2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredArticles?.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                {t('articles.noArticles')}
              </h3>
              <button
                onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                className="text-primary hover:underline"
              >
                {t('search.resetFilters')}
              </button>
            </div>
          ) : (
            <>
              {featuredArticle && !searchQuery && !selectedCategory && (
                <Link to={`/articles/${featuredArticle.slug}`} className="block mb-12">
                  <Card className="overflow-hidden group hover:shadow-2xl transition-all duration-500 border-0 bg-gradient-to-r from-card to-card/80">
                    <div className="grid md:grid-cols-2 gap-0">
                      <div className="relative h-64 md:h-auto md:min-h-[400px] overflow-hidden">
                        <img
                          src={getArticleCover(featuredArticle, 0)}
                          alt={featuredArticle.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-primary text-primary-foreground shadow-lg">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {t('articles.featured')}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-8 md:p-12 flex flex-col justify-center">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {featuredArticle.published_at
                                ? format(new Date(featuredArticle.published_at), "d MMMM yyyy", { locale: ru })
                                : t('common.today')}
                            </span>
                          </div>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{estimateReadTime(featuredArticle.content)} {t('articles.readTime')}</span>
                          </div>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                          <div className="flex items-center gap-1" title="Просмотры">
                            <Eye className="h-4 w-4" />
                            <span>{formatCount(featuredArticle.view_count)}</span>
                          </div>
                          <div className="flex items-center gap-1" title="Лайки">
                            <Heart className="h-4 w-4" />
                            <span>{formatCount(featuredArticle.likes_count)}</span>
                          </div>
                          <div className="flex items-center gap-1" title="Поделились">
                            <Share2 className="h-4 w-4" />
                            <span>{formatCount(featuredArticle.shares_count)}</span>
                          </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight">
                          {featuredArticle.title}
                        </h2>
                        <p className="text-muted-foreground text-lg mb-6 line-clamp-3">
                          {featuredArticle.excerpt}
                        </p>
                        {featuredArticle.meta_keywords && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {featuredArticle.meta_keywords.slice(0, 4).map((keyword: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center text-primary font-semibold group-hover:gap-3 transition-all">
                          <span>{t('articles.readMore')}</span>
                          <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-2 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(searchQuery || selectedCategory ? filteredArticles : regularArticles)?.map((article, index) => (
                  <Link key={article.id} to={`/articles/${article.slug}`}>
                    <Card className="h-full group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-card">
                      <div className="relative h-56 overflow-hidden">
                        <img
                          src={getArticleCover(article, index + 1)}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="flex items-center gap-2 text-xs text-foreground/80">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {article.published_at
                                ? format(new Date(article.published_at), "d MMMM yyyy", { locale: ru })
                                : t('common.today')}
                            </span>
                            <span className="mx-1">•</span>
                            <Clock className="h-3 w-3" />
                            <span>{estimateReadTime(article.content)} {t('articles.readTime')}</span>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3">
                          {article.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                          {article.excerpt}
                        </p>
                        {article.meta_keywords && article.meta_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {article.meta_keywords.slice(0, 2).map((keyword: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1" title="Просмотры">
                              <Eye className="h-3.5 w-3.5" />
                              {formatCount(article.view_count)}
                            </span>
                            <span className="flex items-center gap-1" title="Лайки">
                              <Heart className="h-3.5 w-3.5" />
                              {formatCount(article.likes_count)}
                            </span>
                            <span className="flex items-center gap-1" title="Поделились">
                              <Share2 className="h-3.5 w-3.5" />
                              {formatCount(article.shares_count)}
                            </span>
                          </div>
                          <div className="flex items-center text-primary text-sm font-medium">
                            <span>{t('articles.readMore')}</span>
                            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Articles;
