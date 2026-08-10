import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ArticleDetail markdown code splitting", () => {
  it("keeps markdown parsing libraries out of the route component eager imports", () => {
    const articleDetailSource = readFileSync(
      resolve(process.cwd(), "src/pages/ArticleDetail.tsx"),
      "utf8",
    );
    const markdownSource = readFileSync(
      resolve(process.cwd(), "src/components/articles/ArticleMarkdown.tsx"),
      "utf8",
    );
    const markdownRendererSource = readFileSync(
      resolve(process.cwd(), "src/components/articles/ArticleMarkdownRenderer.tsx"),
      "utf8",
    );

    expect(articleDetailSource).not.toMatch(/import\s+DOMPurify\s+from\s+["']dompurify["']/);
    expect(articleDetailSource).not.toMatch(/import\s+\{\s*marked\s*\}\s+from\s+["']marked["']/);
    expect(articleDetailSource).toContain('import("@/components/articles/ArticleMarkdown")');
    expect(markdownSource).not.toMatch(/from\s+["']dompurify["']/);
    expect(markdownSource).not.toMatch(/from\s+["']marked["']/);
    expect(markdownSource).toContain('import("@/components/articles/ArticleMarkdownRenderer")');
    expect(markdownRendererSource).toContain('from "dompurify"');
    expect(markdownRendererSource).toContain('from "marked"');
  });
});
