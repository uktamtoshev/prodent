export const TOOTH_PART_NAMES = [
  "Enamel",
  "Dentin",
  "Pulp",
  "RootCanal",
  "Cementum",
  "PeriodontalLigament",
] as const;

export type ToothPartName = (typeof TOOTH_PART_NAMES)[number];

export interface ToothAnatomyPart {
  readonly nodeName: ToothPartName;
  readonly label: string;
  readonly description: string;
  /** Цвет служит только для различения слоёв в интерфейсе. */
  readonly color: `#${string}`;
}

function definePart(part: ToothAnatomyPart): Readonly<ToothAnatomyPart> {
  return Object.freeze(part);
}

export const TOOTH_ANATOMY: Readonly<Record<ToothPartName, ToothAnatomyPart>> =
  Object.freeze({
    Enamel: definePart({
      nodeName: "Enamel",
      label: "Эмаль",
      description:
        "Твёрдая минерализованная ткань, покрывающая коронковую часть зуба.",
      color: "#F3F0DF",
    }),
    Dentin: definePart({
      nodeName: "Dentin",
      label: "Дентин",
      description:
        "Минерализованная ткань, образующая основную массу зуба и окружающая полость пульпы.",
      color: "#D8B36A",
    }),
    Pulp: definePart({
      nodeName: "Pulp",
      label: "Пульпа",
      description:
        "Мягкая соединительная ткань внутри зуба, содержащая сосуды и нервные волокна.",
      color: "#D96A6A",
    }),
    RootCanal: definePart({
      nodeName: "RootCanal",
      label: "Корневой канал",
      description:
        "Внутреннее пространство корня зуба, в котором располагается корневая часть пульпы.",
      color: "#A94352",
    }),
    Cementum: definePart({
      nodeName: "Cementum",
      label: "Цемент корня",
      description:
        "Минерализованная ткань, покрывающая наружную поверхность корня зуба.",
      color: "#C9A982",
    }),
    PeriodontalLigament: definePart({
      nodeName: "PeriodontalLigament",
      label: "Периодонтальная связка",
      description:
        "Соединительная ткань между цементом корня и стенкой альвеолы, участвующая в фиксации зуба.",
      color: "#E4A09C",
    }),
  });

const TOOTH_PART_NAME_SET: ReadonlySet<string> = new Set(TOOTH_PART_NAMES);

export function isToothPartName(nodeName: string): nodeName is ToothPartName {
  return TOOTH_PART_NAME_SET.has(nodeName);
}

export function getToothAnatomy(part: ToothPartName): ToothAnatomyPart {
  return TOOTH_ANATOMY[part];
}
