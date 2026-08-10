/**
 * Counters & engagement helpers for blog posts.
 * Idempotency for views/likes is enforced client-side via storage.
 */

const STORAGE_PREFIX = "prodent_blog_";

const viewKey = (slug: string, lang: string) =>
  `${STORAGE_PREFIX}viewed_${slug}_${lang}`;
const likeKey = (slug: string, lang: string) =>
  `${STORAGE_PREFIX}liked_${slug}_${lang}`;

/** Format integer as «12.3k» for >= 1000, «1.2M» for >= 1_000_000. */
export function formatCount(n: number | null | undefined): string {
  if (!n) return "0";
  const v = Math.max(0, Math.trunc(n));
  if (v < 1000) return String(v);
  if (v < 10_000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (v < 1_000_000) return Math.floor(v / 1000) + "k";
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/** Fire-and-forget view bump (deduped per session via sessionStorage). */
export async function recordView(slug: string, lang: string): Promise<number | null> {
  try {
    if (typeof window === "undefined") return null;
    if (window.sessionStorage.getItem(viewKey(slug, lang))) return null;
    window.sessionStorage.setItem(viewKey(slug, lang), "1");
    const res = await fetch(
      `/api/v1/public/blog/${encodeURIComponent(slug)}/view?lang=${lang}`,
      { method: "POST" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.viewCount ?? null;
  } catch {
    return null;
  }
}

/** Returns whether the user has liked this post on this device. */
export function hasLiked(slug: string, lang: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(likeKey(slug, lang)) === "1";
  } catch {
    return false;
  }
}

/** Toggle a like. Returns the fresh count or null on error. */
export async function toggleLike(
  slug: string,
  lang: string,
): Promise<{ likesCount: number; liked: boolean } | null> {
  try {
    if (typeof window === "undefined") return null;
    const liked = hasLiked(slug, lang);
    const delta = liked ? -1 : 1;
    const res = await fetch(
      `/api/v1/public/blog/${encodeURIComponent(slug)}/like?lang=${lang}&delta=${delta}`,
      { method: "POST" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const nowLiked = !liked;
    if (nowLiked) {
      window.localStorage.setItem(likeKey(slug, lang), "1");
    } else {
      window.localStorage.removeItem(likeKey(slug, lang));
    }
    return { likesCount: data?.likesCount ?? 0, liked: nowLiked };
  } catch {
    return null;
  }
}

/** Record a share. Each call counts (a user may share multiple times). */
export async function recordShare(slug: string, lang: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/v1/public/blog/${encodeURIComponent(slug)}/share?lang=${lang}`,
      { method: "POST" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.sharesCount ?? null;
  } catch {
    return null;
  }
}

/**
 * Trigger native share sheet if available, otherwise copy URL to clipboard.
 * Returns one of: 'shared' | 'copied' | 'failed'.
 */
export async function shareOrCopy(
  url: string,
  title: string,
  text?: string,
): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ url, title, text });
      return "shared";
    }
  } catch {
    // user dismissed — fall through to copy
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // ignore
  }
  return "failed";
}
