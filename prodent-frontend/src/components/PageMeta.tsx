import { useEffect } from "react";

interface PageMetaProps {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
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
}: PageMetaProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (name: string, content: string | undefined, attr = "name") => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", ogTitle || title, "property");
    setMeta("og:description", ogDescription || description, "property");
    setMeta("og:type", ogType, "property");
    if (ogImage) setMeta("og:image", ogImage, "property");

    // Canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonical;
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, canonical]);

  return null;
}
