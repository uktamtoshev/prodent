import { describe, expect, it } from "vitest";
import { TOOTH_PART_NAMES } from "../../src/data/toothAnatomy";
import {
  createInitialMaterialState,
  materialStateReducer,
} from "../../src/viewer/materialState";

describe("materialStateReducer", () => {
  it("создаёт состояние со всеми видимыми непрозрачными слоями", () => {
    const state = createInitialMaterialState();

    expect(state.selectedPart).toBeNull();
    expect(state.isolatedPart).toBeNull();
    expect(
      TOOTH_PART_NAMES.every(
        (part) => state.layers[part].visible && !state.layers[part].transparent,
      ),
    ).toBe(true);
  });

  it("выбирает и снимает выбор без изменения исходного состояния", () => {
    const initial = createInitialMaterialState();
    const selected = materialStateReducer(initial, {
      type: "select",
      part: "Enamel",
    });
    const cleared = materialStateReducer(selected, {
      type: "select",
      part: null,
    });

    expect(initial.selectedPart).toBeNull();
    expect(selected.selectedPart).toBe("Enamel");
    expect(cleared.selectedPart).toBeNull();
    expect(selected).not.toBe(initial);
    expect(selected.layers).toBe(initial.layers);
  });

  it("изменяет видимость только выбранного слоя", () => {
    const initial = createInitialMaterialState();
    const hidden = materialStateReducer(initial, {
      type: "setVisibility",
      part: "Dentin",
      visible: false,
    });

    expect(hidden.layers.Dentin.visible).toBe(false);
    expect(initial.layers.Dentin.visible).toBe(true);
    expect(hidden.layers.Enamel).toBe(initial.layers.Enamel);
    expect(hidden.layers).not.toBe(initial.layers);
  });

  it("переключает прозрачность независимо от видимости", () => {
    const initial = createInitialMaterialState();
    const transparent = materialStateReducer(initial, {
      type: "toggleTransparency",
      part: "Pulp",
    });

    expect(transparent.layers.Pulp.transparent).toBe(true);
    expect(transparent.layers.Pulp.visible).toBe(true);
    expect(initial.layers.Pulp.transparent).toBe(false);
  });

  it("изолирует один слой и сохраняет настройки прозрачности", () => {
    const initial = materialStateReducer(createInitialMaterialState(), {
      type: "setTransparency",
      part: "RootCanal",
      transparent: true,
    });
    const isolated = materialStateReducer(initial, {
      type: "isolate",
      part: "RootCanal",
    });

    expect(isolated.selectedPart).toBe("RootCanal");
    expect(isolated.isolatedPart).toBe("RootCanal");
    expect(isolated.layers.RootCanal.visible).toBe(true);
    expect(isolated.layers.RootCanal.transparent).toBe(true);
    expect(
      TOOTH_PART_NAMES.filter(
        (part) => part !== "RootCanal" && isolated.layers[part].visible,
      ),
    ).toEqual([]);
  });

  it("показывает все слои, не сбрасывая выбор и прозрачность", () => {
    const isolated = materialStateReducer(createInitialMaterialState(), {
      type: "isolate",
      part: "Cementum",
    });
    const transparent = materialStateReducer(isolated, {
      type: "setTransparency",
      part: "Cementum",
      transparent: true,
    });
    const shown = materialStateReducer(transparent, { type: "showAll" });

    expect(shown.selectedPart).toBe("Cementum");
    expect(shown.isolatedPart).toBeNull();
    expect(shown.layers.Cementum.transparent).toBe(true);
    expect(TOOTH_PART_NAMES.every((part) => shown.layers[part].visible)).toBe(
      true,
    );
  });

  it("ручное изменение видимости завершает режим изоляции", () => {
    const isolated = materialStateReducer(createInitialMaterialState(), {
      type: "isolate",
      part: "PeriodontalLigament",
    });
    const changed = materialStateReducer(isolated, {
      type: "setVisibility",
      part: "Enamel",
      visible: true,
    });

    expect(changed.isolatedPart).toBeNull();
    expect(changed.layers.PeriodontalLigament.visible).toBe(true);
    expect(changed.layers.Enamel.visible).toBe(true);
  });
});
