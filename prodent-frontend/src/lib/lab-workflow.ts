import { languageRuntime } from "@/i18n/language-runtime";
import type { Language } from "@/i18n/types";
import type { LabOrderStatus } from "./lab";

export const LAB_PRODUCTION_FLOW: readonly LabOrderStatus[] = [
  "queued",
  "model",
  "wax",
  "milling",
  "frame",
  "glaze",
  "ready",
  "delivered",
];

const TERMINAL = new Set<LabOrderStatus>(["delivered", "cancelled", "declined"]);

type Translate = (key: string) => string;

export function getLabStatusLabel(
  status: string,
  translate: Translate | Language = (key) => languageRuntime.translate(key),
): string {
  const t =
    typeof translate === "function"
      ? translate
      : (key: string) => languageRuntime.translate(key);
  const key = `labCustomer.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export function getNextLabStatus(status: LabOrderStatus): LabOrderStatus | null {
  // READY is handed over by the clinic through /receive, never by technician advance.
  if (status === "ready") return null;
  if (TERMINAL.has(status)) return null;
  const index = LAB_PRODUCTION_FLOW.indexOf(status);
  if (index < 0 || index === LAB_PRODUCTION_FLOW.length - 1) return null;
  return LAB_PRODUCTION_FLOW[index + 1];
}

export function normalizeClarification(value: string): string {
  const text = value.trim();
  if (!text) throw new Error("clarification_required");
  return text;
}

export function toTashkentOffsetDateTime(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    throw new Error("invalid_due_at");
  }
  return `${normalized}:00+05:00`;
}
