import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Share2, BookOpen, ChevronRight, User, Heart, Eye } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { formatCount, hasLiked, recordShare, recordView, shareOrCopy, toggleLike } from "@/lib/engagement";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { uzLatinToCyrl } from "@/lib/uzbek-transliterate";
import { PageMeta } from "@/components/PageMeta";
import { ArticleSchema, BreadcrumbListSchema } from "@/components/StructuredData";

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

const ArticleMarkdown = lazy(() =>
  import("@/components/articles/ArticleMarkdown").then((module) => ({
    default: module.ArticleMarkdown,
  })),
);

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

interface ArticleView {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null | undefined;
  content: string | null | undefined;
  cover_url: string | null | undefined;
  published_at: string | null | undefined;
  meta_keywords: string[];
  view_count: number;
  likes_count: number;
  shares_count: number;
}

const ArticleDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { language, t } = useLanguage();
  // uz_cyrl грузит uz (latin) и транслитерирует на лету.
  const articleLang =
    language === 'uz' || language === 'uz_cyrl' ? 'uz'
    : language === 'ru' ? 'ru'
    : 'ru';
  const needCyrl = language === 'uz_cyrl';

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", slug, articleLang, needCyrl],
    queryFn: async () => {
      const res = await fetch(`/api/v1/public/blog/${slug}?lang=${articleLang}`);
      if (!res.ok) throw new Error(`Failed to load article: ${res.status}`);
      const p = await res.json() as BlogPostResponse;
      return {
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
      };
    },
  });

  const { data: relatedArticles } = useQuery({
    queryKey: ["related-articles", article?.id, articleLang, needCyrl],
    queryFn: async () => {
      if (!article) return [];
      const res = await fetch(`/api/v1/public/blog?lang=${articleLang}&size=10`);
      if (!res.ok) return [];
      const json = await res.json();
      const rows = ((json.content ?? []) as BlogPostResponse[])
        .filter((p) => p.id !== article.id)
        .slice(0, 3);
      return rows.map((p): ArticleView => ({
        id: p.id,
        title: needCyrl ? uzLatinToCyrl(p.title) : p.title,
        slug: p.slug,
        excerpt: needCyrl ? uzLatinToCyrl(p.excerpt ?? "") : p.excerpt,
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

  const estimateReadTime = (content: string | null) => {
    if (!content) return 3;
    const words = content.split(/\s+/).length;
    return Math.max(3, Math.ceil(words / 200));
  };

  // ── Engagement state (likes / shares / views) ───────────────────────────
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [sharesCount, setSharesCount] = useState<number>(0);
  const [viewCount, setViewCount] = useState<number>(0);

  // Hydrate state from server payload, then bump view (deduped per session).
  useEffect(() => {
    if (!article || !slug) return;
    setLikesCount(article.likes_count ?? 0);
    setSharesCount(article.shares_count ?? 0);
    setViewCount(article.view_count ?? 0);
    setLiked(hasLiked(slug, articleLang));
    recordView(slug, articleLang).then((fresh) => {
      if (typeof fresh === "number") setViewCount(fresh);
    });
  }, [article, slug, articleLang]);

  const handleLike = async () => {
    if (!slug) return;
    const result = await toggleLike(slug, articleLang);
    if (result) {
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    }
  };

  const handleShare = async () => {
    if (!article || !slug) return;
    const url = window.location.href;
    const outcome = await shareOrCopy(url, article.title, article.excerpt || "");
    if (outcome === "shared" || outcome === "copied") {
      const fresh = await recordShare(slug, articleLang);
      if (typeof fresh === "number") setSharesCount(fresh);
      if (outcome === "copied") toast.success("Ссылка скопирована в буфер обмена");
    } else if (outcome === "failed") {
      toast.error("Не удалось поделиться");
    }
  };

  const getArticleCover = (articleSlug: string, index: number, fromDb?: string | null) => {
    // Prefer the cover saved in the DB (set by seed / admin) over the hard-
    // coded fallback map. Falls back to a category-themed default when the
    // article doesn't have a cover yet.
    return fromDb || articleCovers[articleSlug] || defaultCovers[index % defaultCovers.length];
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

  // ── SEO ──────────────────────────────────────────────────
  const canonicalUrl = `https://prodent.uz/articles/${article.slug}`;
  const seoTitle = `${article.title} | PRODENT`;
  const seoDescription =
    article.excerpt ||
    (article.content
      ? article.content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 160)
      : article.title);
  const seoImage = getArticleCover(article.slug, 0, article.cover_url);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        ogType="article"
        ogImage={seoImage}
      />
      <ArticleSchema
        headline={article.title}
        description={article.excerpt || undefined}
        image={seoImage}
        authorName="PRODENT"
        publishedAt={article.published_at || new Date().toISOString()}
        url={canonicalUrl}
      />
      <BreadcrumbListSchema
        items={[
          { name: t("nav.home"), url: "https://prodent.uz/" },
          { name: t("nav.articles"), url: "https://prodent.uz/articles" },
          { name: article.title, url: canonicalUrl },
        ]}
      />
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
            src={getArticleCover(article.slug, 0, article.cover_url)}
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

                {/* Inline cover photo — sits at the top of the article body
                    so readers see the same image inside the post (not only
                    behind the title hero). Falls back to default if missing. */}
                {article.cover_url && (
                  <figure className="mb-8 -mx-6 md:-mx-10 lg:-mx-12">
                    <img
                      src={getArticleCover(article.slug, 0, article.cover_url)}
                      alt={article.title}
                      className="w-full h-auto max-h-[480px] object-cover"
                      loading="lazy"
                    />
                  </figure>
                )}

                {/* Article content */}
                <Suspense
                  fallback={
                    <div className="space-y-4" aria-label="Загрузка статьи">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  }
                >
                  <ArticleMarkdown content={article.content} />
                </Suspense>

                {/* Divider */}
                <div className="h-px bg-border my-8" />

                {/* Engagement counters & actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5" title="Просмотры">
                      <Eye className="h-4 w-4" />
                      {formatCount(viewCount)}
                    </span>
                    <span className="flex items-center gap-1.5" title="Лайки">
                      <Heart className="h-4 w-4" />
                      {formatCount(likesCount)}
                    </span>
                    <span className="flex items-center gap-1.5" title="Поделились">
                      <Share2 className="h-4 w-4" />
                      {formatCount(sharesCount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={liked ? "default" : "outline"}
                      size="sm"
                      onClick={handleLike}
                      className={`rounded-full ${liked ? "bg-red-500 hover:bg-red-600 border-red-500 text-white" : ""}`}
                    >
                      <Heart className={`h-4 w-4 mr-2 ${liked ? "fill-current" : ""}`} />
                      {liked ? "Нравится" : "Нравится"}
                    </Button>
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
                          src={getArticleCover(related.slug, index, related.cover_url)}
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
