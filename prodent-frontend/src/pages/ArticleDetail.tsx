import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Share2, BookOpen, ChevronRight, User, Heart } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// Import default cover images
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

const ArticleDetail = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: relatedArticles } = useQuery({
    queryKey: ["related-articles", article?.id],
    queryFn: async () => {
      if (!article) return [];
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, cover_image, published_at, meta_keywords")
        .eq("published", true)
        .neq("id", article.id)
        .limit(3);

      if (error) throw error;
      return data;
    },
    enabled: !!article,
  });

  const estimateReadTime = (content: string | null) => {
    if (!content) return 3;
    const words = content.split(/\s+/).length;
    return Math.max(3, Math.ceil(words / 200));
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.excerpt || "",
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована в буфер обмена");
    }
  };

  const getArticleCover = (articleSlug: string, index: number) => {
    return articleCovers[articleSlug] || defaultCovers[index % defaultCovers.length];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-6 w-64 mb-8" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-24 text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Статья не найдена
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            К сожалению, запрашиваемая статья не найдена. Возможно, она была удалена или перемещена.
          </p>
          <Link to="/articles">
            <Button size="lg" className="rounded-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Вернуться к статьям
            </Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        {/* Breadcrumb */}
        <div className="border-b border-border/50 bg-muted/30">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">
                Главная
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link to="/articles" className="hover:text-foreground transition-colors">
                Статьи
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground line-clamp-1">{article.title}</span>
            </nav>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative h-[300px] md:h-[450px] lg:h-[500px] overflow-hidden">
          <img
            src={getArticleCover(article.slug, 0)}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Back button overlay */}
          <div className="absolute top-4 left-4">
            <Link to="/articles">
              <Button variant="secondary" size="sm" className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Все статьи
              </Button>
            </Link>
          </div>
        </div>

        {/* Article Content */}
        <article className="container mx-auto px-4 -mt-32 relative z-10">
          <div className="max-w-3xl mx-auto">
            {/* Article Card */}
            <div className="bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden">
              <div className="p-6 md:p-10 lg:p-12">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span>PRODENT</span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {article.published_at
                        ? format(new Date(article.published_at), "d MMMM yyyy", { locale: ru })
                        : "Недавно"}
                    </span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{estimateReadTime(article.content)} мин чтения</span>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6 leading-tight">
                  {article.title}
                </h1>

                {/* Tags */}
                {article.meta_keywords && article.meta_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {article.meta_keywords.map((keyword: string, idx: number) => (
                      <Link key={idx} to={`/articles?category=${keyword}`}>
                        <Badge variant="secondary" className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                          {keyword}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-border mb-8" />

                {/* Article content */}
                <div 
                  className="prose prose-lg max-w-none dark:prose-invert 
                    prose-headings:text-foreground prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4
                    prose-h2:text-2xl prose-h3:text-xl
                    prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:mb-6
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-foreground prose-strong:font-semibold
                    prose-ul:text-foreground/85 prose-ol:text-foreground/85
                    prose-li:mb-2
                    prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:text-muted-foreground prose-blockquote:italic
                    prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                    prose-img:rounded-xl prose-img:shadow-lg"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content || "") }}
                />

                {/* Divider */}
                <div className="h-px bg-border my-8" />

                {/* Share & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Поделиться:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className="rounded-full"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Поделиться
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500">
                    <Heart className="h-4 w-4 mr-2" />
                    Добавить в избранное
                  </Button>
                </div>
              </div>
            </div>

            {/* CTA Block */}
            <Card className="mt-8 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border-0">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-bold text-foreground mb-3">
                  Нужна консультация стоматолога?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Найдите лучших специалистов в вашем городе и запишитесь на приём онлайн
                </p>
                <Link to="/search">
                  <Button size="lg" className="rounded-full">
                    Найти стоматолога
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Related articles */}
          {relatedArticles && relatedArticles.length > 0 && (
            <section className="max-w-5xl mx-auto mt-16 mb-12">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Читайте также
                </h2>
                <Link to="/articles" className="text-primary hover:underline font-medium flex items-center gap-1">
                  Все статьи
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((related, index) => (
                  <Link
                    key={related.id}
                    to={`/articles/${related.slug}`}
                    className="group"
                  >
                    <Card className="h-full overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={getArticleCover(related.slug, index)}
                          alt={related.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      </div>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {related.published_at
                              ? format(new Date(related.published_at), "d MMMM", { locale: ru })
                              : "Недавно"}
                          </span>
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                          {related.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {related.excerpt}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default ArticleDetail;
