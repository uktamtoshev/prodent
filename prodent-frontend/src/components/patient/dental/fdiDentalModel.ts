export type ToothStatus =
  | "unexamined"
  | "healthy"
  | "caries"
  | "filling"
  | "crown"
  | "implant"
  | "removed"
  | "watch"
  | "endo"
  | "periodontitis";

export type ToothKind = "molar" | "premolar" | "canine" | "incisor";
export type DentalArch = "upper" | "lower";
export type DentitionType = "child" | "young" | "adult";

export interface FdiToothLayout {
  number: number;
  kind: ToothKind;
  arch: DentalArch;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const YOUNG_UPPER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const YOUNG_LOWER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const STATUS_ALIASES: Record<string, ToothStatus> = {
  sound: "healthy",
  normal: "healthy",
  decay: "caries",
  cavity: "caries",
  filled: "filling",
  treated: "filling",
  missing: "removed",
  extracted: "removed",
  extraction: "removed",
  observation: "watch",
  root_canal: "endo",
  endodontics: "endo",
  periodontal: "periodontitis",
  bridge: "crown",
  veneer: "crown",
  extraction_needed: "watch",
};

const VALID_STATUSES = new Set<ToothStatus>([
  "unexamined",
  "healthy",
  "caries",
  "filling",
  "crown",
  "implant",
  "removed",
  "watch",
  "endo",
  "periodontitis",
]);

export function normalizeToothStatus(status: string | null | undefined): ToothStatus {
  if (!status?.trim()) return "unexamined";
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_STATUSES.has(normalized as ToothStatus)) return normalized as ToothStatus;
  // Unknown clinical values must stay visible instead of looking healthy.
  return STATUS_ALIASES[normalized] || "watch";
}

export function calculateDentalAge(birthDate?: string | null): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  if (birth > today) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return Math.max(0, age);
}

export function getDentitionType(age: number): DentitionType {
  if (age < 12) return "child";
  if (age < 20) return "young";
  return "adult";
}

export function getFdiNumbers(dentition: DentitionType): {
  upper: number[];
  lower: number[];
} {
  if (dentition === "child") {
    return { upper: CHILD_UPPER, lower: CHILD_LOWER };
  }

  if (dentition === "young") {
    return { upper: YOUNG_UPPER, lower: YOUNG_LOWER };
  }

  return { upper: ADULT_UPPER, lower: ADULT_LOWER };
}

export function getToothKind(number: number): ToothKind {
  const digit = number % 10;
  const isPrimary = number >= 50;

  if (digit <= 2) return "incisor";
  if (digit === 3) return "canine";
  if (isPrimary) return "molar";
  if (digit <= 5) return "premolar";
  return "molar";
}

function createArchLayout(
  numbers: number[],
  arch: DentalArch,
  dentition: DentitionType,
): FdiToothLayout[] {
  const archScale = dentition === "child" ? 0.82 : dentition === "young" ? 0.94 : 1;
  const toothScale = dentition === "child" ? 0.88 : dentition === "young" ? 0.96 : 1;
  const y = arch === "upper" ? 0.50 : -0.25;

  // Anatomical centres measured from the midline outwards. Keeping each FDI
  // position explicit prevents the posterior teeth from looking like a flat,
  // evenly spaced keyboard row.
  const upperPoints: Record<number, readonly [number, number, number]> = {
    1: [0.43, 3.58, 0.04],
    2: [1.22, 3.43, 0.13],
    3: [2.04, 3.08, 0.24],
    4: [2.88, 2.49, 0.38],
    5: [3.72, 1.67, 0.52],
    6: [4.55, 0.57, 0.66],
    7: [5.30, -0.79, 0.80],
    8: [5.92, -2.25, 0.92],
  };
  const lowerPoints: Record<number, readonly [number, number, number]> = {
    1: [0.32, 3.34, 0.03],
    2: [0.94, 3.23, 0.11],
    3: [1.66, 2.94, 0.22],
    4: [2.43, 2.42, 0.36],
    5: [3.20, 1.67, 0.50],
    6: [4.02, 0.61, 0.65],
    7: [4.80, -0.69, 0.79],
    8: [5.48, -2.08, 0.91],
  };
  const points = arch === "upper" ? upperPoints : lowerPoints;
  const half = numbers.length / 2;

  return numbers.map((number, index) => {
    const digit = number % 10;
    const [baseX, baseZ, baseRotation] = points[digit] || points[5];
    const side = index < half ? -1 : 1;
    const x = side * baseX * archScale;
    const z = baseZ * archScale;
    const rotationY = side * baseRotation;

    return {
      number,
      kind: getToothKind(number),
      arch,
      position: [x, y, z],
      rotationY,
      scale: toothScale,
    };
  });
}

export function createFdiLayout(dentition: DentitionType): FdiToothLayout[] {
  const numbers = getFdiNumbers(dentition);
  return [
    ...createArchLayout(numbers.upper, "upper", dentition),
    ...createArchLayout(numbers.lower, "lower", dentition),
  ];
}

export const TOOTH_STATUS_ORDER: ToothStatus[] = [
  "unexamined",
  "healthy",
  "caries",
  "filling",
  "crown",
  "implant",
  "removed",
  "watch",
  "endo",
  "periodontitis",
];
