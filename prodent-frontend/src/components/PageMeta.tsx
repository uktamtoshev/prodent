import { useEffect } from "react";

interface PageMetaProps {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  robots?: string;
}

/**
 * Zero-dependency SEO component. Sets document.title and meta tags
 * on mount, restores defaults on unmount.
 *
 * Usage:
 *   <PageMeta title="Dr. Karimov — PRODENT" description="..." />
 */
export function PageMeta({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  canonical,
  robots,
}: PageMetaProps) {
  useEffect(() => {
    const prevTitle = document.title;
    const restoreHead: Array<() => void> = [];
    document.title = title;

    const setMeta = (name: string, content: string | undefined, attr = "name") => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      const created = !el;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      const previousContent = el.getAttribute("content");
      el.setAttribute("content", content);
      restoreHead.push(() => {
        if (created) {
          el?.remove();
        } else if (previousContent == null) {
          el?.removeAttribute("content");
        } else {
          el?.setAttribute("content", previousContent);
        }
      });
    };

    setMeta("description", description);
    setMeta("og:title", ogTitle || title, "property");
    setMeta("og:description", ogDescription || description, "property");
    setMeta("og:type", ogType, "property");
    if (ogImage) setMeta("og:image", ogImage, "property");
    setMeta("og:url", canonical, "property");
    setMeta("twitter:title", ogTitle || title);
    setMeta("twitter:description", ogDescription || description);
    setMeta("robots", robots);

    // Canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      const created = !canonicalEl;
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      const previousHref = canonicalEl.getAttribute("href");
      canonicalEl.setAttribute("href", canonical);
      restoreHead.push(() => {
        if (created) {
          canonicalEl?.remove();
        } else if (previousHref == null) {
          canonicalEl?.removeAttribute("href");
        } else {
          canonicalEl?.setAttribute("href", previousHref);
        }
      });
    }

    return () => {
      document.title = prevTitle;
      restoreHead.reverse().forEach((restore) => restore());
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, canonical, robots]);

  return null;
}
