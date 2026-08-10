import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ArticleMarkdownProps {
  content: string | null | undefined;
}

const ArticleMarkdownRenderer = lazy(() =>
  import("@/components/articles/ArticleMarkdownRenderer").then((module) => ({
    default: module.ArticleMarkdownRenderer,
  })),
);

export function ArticleMarkdown({ content }: ArticleMarkdownProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-label="Загрузка статьи">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      }
    >
      <ArticleMarkdownRenderer content={content} />
    </Suspense>
  );
}
