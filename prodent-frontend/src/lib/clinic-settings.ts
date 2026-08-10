import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ClinicSettingResponse {
  key: string;
  value: Json | null;
}

export async function fetchClinicSetting(
  clinicId: string,
  key: string,
): Promise<Json | null> {
  const { data, error } = await supabase.functions.invoke(
    "clinic-settings-get",
    { body: { clinicId, key } },
  );

  if (error) throw error;
  return (data as ClinicSettingResponse).value;
}

export async function saveClinicSetting(
  clinicId: string,
  key: string,
  value: Json,
): Promise<void> {
  const { error } = await supabase.functions.invoke(
    "clinic-settings-set",
    { body: { clinicId, key, value } },
  );

  if (error) throw error;
}

export interface ClinicRoom {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  equipment: string[];
}

function isClinicRoom(value: unknown): value is ClinicRoom {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const room = value as Record<string, unknown>;
  return (
    typeof room.id === "string" &&
    typeof room.name === "string" &&
    (room.description === null || typeof room.description === "string") &&
    typeof room.is_active === "boolean" &&
    Array.isArray(room.equipment) &&
    room.equipment.every((item) => typeof item === "string")
  );
}

export function readClinicRooms(value: unknown): ClinicRoom[] {
  return Array.isArray(value)
    ? value.filter(isClinicRoom)
    : [];
}
