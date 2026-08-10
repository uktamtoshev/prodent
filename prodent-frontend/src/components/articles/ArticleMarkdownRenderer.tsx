import DOMPurify from "dompurify";
import { marked } from "marked";

interface ArticleMarkdownRendererProps {
  content: string | null | undefined;
}

export function ArticleMarkdownRenderer({ content }: ArticleMarkdownRendererProps) {
  return (
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
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked.parse(content || "", { async: false }) as string),
      }}
    />
  );
}
