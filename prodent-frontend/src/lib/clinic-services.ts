import type { Language } from "@/contexts/LanguageContext";
import {
  listPublicClinicServices,
  type ClinicService,
} from "@/lib/clinic-service-management-api";

export interface ClinicServiceOption {
  id: string;
  name: string;
  price: number;
  category: string;
}

function localizedServiceName(row: ClinicService, language: Language): string {
  const localizedNames: Record<Language, string | null> = {
    ru: row.nameRu,
    uz: row.nameUz,
    uz_cyrl: row.nameUzCyrl,
    kz: row.nameKz,
    kg: row.nameKg,
    tj: row.nameTj,
  };

  return localizedNames[language]?.trim()
    || row.nameRu.trim()
    || row.nameUz?.trim()
    || "";
}

export async function loadActiveClinicServiceOptions(
  clinicId: string,
  language: Language,
): Promise<ClinicServiceOption[]> {
  const rows = await listPublicClinicServices(clinicId);
  return rows.map((row) => ({
    id: row.id,
    name: localizedServiceName(row, language),
    price: Number(row.price),
    category: row.category ?? "",
  }));
}
