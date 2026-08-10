/**
 * Schema.org JSON-LD structured data components for SEO.
 * Google uses these for rich snippets in search results.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Physician (for /doctor/:id) ────────────────────────────

interface PhysicianProps {
  name: string;
  specialty?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  clinicName?: string;
  clinicAddress?: string;
  city?: string;
  url: string;
}

export function PhysicianSchema({
  name, specialty, image, rating, reviewCount,
  clinicName, clinicAddress, city, url,
}: PhysicianProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    url,
    ...(image && { image }),
    ...(specialty && { medicalSpecialty: specialty }),
    ...(clinicName && {
      worksFor: {
        "@type": "MedicalBusiness",
        name: clinicName,
        ...(clinicAddress && { address: { "@type": "PostalAddress", streetAddress: clinicAddress, addressLocality: city || "Tashkent", addressCountry: "UZ" } }),
      },
    }),
    ...(rating && reviewCount && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
  return <JsonLd data={data} />;
}

// ─── MedicalBusiness (for /clinic/:id) ──────────────────────

interface MedicalBusinessProps {
  name: string;
  description?: string;
  image?: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  url: string;
  latitude?: number;
  longitude?: number;
}

export function MedicalBusinessSchema({
  name, description, image, address, city, phone, email,
  rating, reviewCount, url, latitude, longitude,
}: MedicalBusinessProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name,
    url,
    ...(description && { description }),
    ...(image && { image }),
    ...(phone && { telephone: phone }),
    ...(email && { email }),
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: city,
      addressCountry: "UZ",
    },
    ...(latitude && longitude && {
      geo: { "@type": "GeoCoordinates", latitude, longitude },
    }),
    ...(rating && reviewCount && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
  return <JsonLd data={data} />;
}

// ─── Article (for /articles/:slug) ──────────────────────────

interface ArticleProps {
  headline: string;
  description?: string;
  image?: string;
  authorName: string;
  publishedAt: string;
  url: string;
}

export function ArticleSchema({
  headline, description, image, authorName, publishedAt, url,
}: ArticleProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    url,
    ...(description && { description }),
    ...(image && { image }),
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: "PRODENT",
      url: "https://prodent.uz",
    },
    datePublished: publishedAt,
  };
  return <JsonLd data={data} />;
}

// ─── BreadcrumbList (for detail pages — Главная > раздел > название) ──

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbListSchema({ items }: { items: BreadcrumbItem[] }) {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    }} />
  );
}

// ─── Organization (for landing page — knowledge-panel / brand entity) ──

export function OrganizationSchema() {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "PRODENT",
      url: "https://prodent.uz",
      logo: "https://prodent.uz/og-image.png",
    }} />
  );
}

// ─── WebSite (for landing page — enables Sitelinks search box) ──

export function WebSiteSchema() {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "PRODENT",
      url: "https://prodent.uz",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://prodent.uz/search?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    }} />
  );
}
