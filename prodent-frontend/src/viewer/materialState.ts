import {
  TOOTH_PART_NAMES,
  type ToothPartName,
} from "../data/toothAnatomy";

export const TRANSPARENT_LAYER_OPACITY = 0.3;

export interface ToothLayerState {
  readonly visible: boolean;
  readonly transparent: boolean;
}

export type ToothLayerStateMap = Readonly<
  Record<ToothPartName, ToothLayerState>
>;

export interface MaterialState {
  readonly selectedPart: ToothPartName | null;
  readonly isolatedPart: ToothPartName | null;
  readonly layers: ToothLayerStateMap;
}

export type MaterialStateAction =
  | { readonly type: "select"; readonly part: ToothPartName | null }
  | {
      readonly type: "setVisibility";
      readonly part: ToothPartName;
      readonly visible: boolean;
    }
  | { readonly type: "toggleVisibility"; readonly part: ToothPartName }
  | {
      readonly type: "setTransparency";
      readonly part: ToothPartName;
      readonly transparent: boolean;
    }
  | { readonly type: "toggleTransparency"; readonly part: ToothPartName }
  | { readonly type: "isolate"; readonly part: ToothPartName }
  | { readonly type: "showAll" };

function createDefaultLayers(): ToothLayerStateMap {
  return Object.fromEntries(
    TOOTH_PART_NAMES.map((part) => [
      part,
      { visible: true, transparent: false } satisfies ToothLayerState,
    ]),
  ) as Record<ToothPartName, ToothLayerState>;
}

export function createInitialMaterialState(): MaterialState {
  return {
    selectedPart: null,
    isolatedPart: null,
    layers: createDefaultLayers(),
  };
}

function updateLayer(
  state: MaterialState,
  part: ToothPartName,
  changes: Partial<ToothLayerState>,
  clearIsolation: boolean,
): MaterialState {
  const currentLayer = state.layers[part];
  const visible = changes.visible ?? currentLayer.visible;
  const transparent = changes.transparent ?? currentLayer.transparent;
  const layerChanged =
    visible !== currentLayer.visible || transparent !== currentLayer.transparent;
  const isolationChanged = clearIsolation && state.isolatedPart !== null;

  if (!layerChanged && !isolationChanged) return state;

  return {
    ...state,
    isolatedPart: clearIsolation ? null : state.isolatedPart,
    layers: layerChanged
      ? {
          ...state.layers,
          [part]: { visible, transparent },
        }
      : state.layers,
  };
}

function hasIsolationLayout(
  state: MaterialState,
  isolatedPart: ToothPartName,
): boolean {
  return TOOTH_PART_NAMES.every(
    (part) => state.layers[part].visible === (part === isolatedPart),
  );
}

export function materialStateReducer(
  state: MaterialState,
  action: MaterialStateAction,
): MaterialState {
  switch (action.type) {
    case "select":
      return state.selectedPart === action.part
        ? state
        : { ...state, selectedPart: action.part };

    case "setVisibility":
      return updateLayer(
        state,
        action.part,
        { visible: action.visible },
        true,
      );

    case "toggleVisibility":
      return updateLayer(
        state,
        action.part,
        { visible: !state.layers[action.part].visible },
        true,
      );

    case "setTransparency":
      return updateLayer(
        state,
        action.part,
        { transparent: action.transparent },
        false,
      );

    case "toggleTransparency":
      return updateLayer(
        state,
        action.part,
        { transparent: !state.layers[action.part].transparent },
        false,
      );

    case "isolate": {
      if (
        state.selectedPart === action.part &&
        state.isolatedPart === action.part &&
        hasIsolationLayout(state, action.part)
      ) {
        return state;
      }

      const layers = Object.fromEntries(
        TOOTH_PART_NAMES.map((part) => [
          part,
          {
            ...state.layers[part],
            visible: part === action.part,
          },
        ]),
      ) as Record<ToothPartName, ToothLayerState>;

      return {
        ...state,
        selectedPart: action.part,
        isolatedPart: action.part,
        layers,
      };
    }

    case "showAll": {
      const hasHiddenLayer = TOOTH_PART_NAMES.some(
        (part) => !state.layers[part].visible,
      );
      if (!hasHiddenLayer && state.isolatedPart === null) return state;

      const layers = Object.fromEntries(
        TOOTH_PART_NAMES.map((part) => [
          part,
          state.layers[part].visible
            ? state.layers[part]
            : { ...state.layers[part], visible: true },
        ]),
      ) as Record<ToothPartName, ToothLayerState>;

      return { ...state, isolatedPart: null, layers };
    }
  }
}
