import { isPublicPromotionCurrent } from "./publicPromotion";

export interface BookingPromotion {
  id: string;
  title: string;
  discount: number;
  price: number;
  old_price: number;
  valid_until: string;
  active: boolean;
  doctor_id: string | null;
  clinic_id: string | null;
}

export function isBookingPromotionApplicable(
  promotion: Pick<BookingPromotion, "active" | "valid_until" | "doctor_id" | "clinic_id">,
  doctorId: string,
  clinicId: string | null | undefined,
): boolean {
  if (!isPublicPromotionCurrent(promotion)) return false;
  return promotion.doctor_id === doctorId ||
    (Boolean(clinicId) && promotion.clinic_id === clinicId);
}
