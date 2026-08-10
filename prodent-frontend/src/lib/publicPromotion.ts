export interface PublicPromotionLink {
  id: string;
  doctor_id?: string | null;
  clinic_id?: string | null;
}

export interface PublicPromotionValidity {
  active?: boolean | null;
  valid_until?: string | null;
}

function queryForPromotion(id: string): string {
  return new URLSearchParams({ promo: id }).toString();
}

export function getPublicPromotionTarget(promotion: PublicPromotionLink): string {
  const query = queryForPromotion(promotion.id);
  if (promotion.doctor_id) {
    return `/book/${encodeURIComponent(promotion.doctor_id)}?${query}`;
  }
  if (promotion.clinic_id) {
    return `/clinic/${encodeURIComponent(promotion.clinic_id)}?${query}`;
  }
  return `/search?${query}`;
}

export function isPublicPromotionCurrent(
  promotion: PublicPromotionValidity,
  now = new Date(),
): boolean {
  if (promotion.active === false) return false;
  if (!promotion.valid_until) return true;
  const end = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(promotion.valid_until)
      ? `${promotion.valid_until}T23:59:59.999Z`
      : promotion.valid_until,
  );
  return Number.isFinite(end.getTime()) && end.getTime() >= now.getTime();
}
