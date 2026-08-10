import {
  getToothAnatomy,
  TOOTH_PART_NAMES,
  type ToothPartName,
} from "../data/toothAnatomy";
import type { MaterialState } from "../viewer/materialState";

export interface LayerPanelCallbacks {
  readonly onVisibilityChange: (
    part: ToothPartName,
    visible: boolean,
  ) => void;
  readonly onSelect: (part: ToothPartName) => void;
  readonly onShowAll: () => void;
}

interface LayerControls {
  readonly checkbox: HTMLInputElement;
  readonly selectButton: HTMLButtonElement;
  readonly row: HTMLLIElement;
  readonly onCheckboxChange: () => void;
  readonly onSelectClick: () => void;
}

let layerPanelSequence = 0;

export class LayerPanel {
  public readonly element: HTMLElement;

  private readonly controls = new Map<ToothPartName, LayerControls>();
  private readonly showAllButton = document.createElement("button");
  private readonly liveStatus = document.createElement("p");

  public constructor(
    container: HTMLElement,
    private readonly callbacks: LayerPanelCallbacks,
  ) {
    const panelId = `tooth-layer-panel-title-${++layerPanelSequence}`;

    this.element = document.createElement("section");
    this.element.className = "tooth-layer-panel";
    this.element.dataset.testid = "layer-panel";
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "Слои анатомической модели зуба");

    const header = document.createElement("div");
    header.className = "tooth-layer-header";
    const heading = document.createElement("h2");
    heading.id = panelId;
    heading.className = "tooth-panel-heading";
    heading.textContent = "Слои";
    this.element.setAttribute("aria-labelledby", panelId);

    this.showAllButton.type = "button";
    this.showAllButton.className = "tooth-layer-show-all";
    this.showAllButton.dataset.testid = "layer-show-all";
    this.showAllButton.textContent = "Показать все";
    this.showAllButton.setAttribute("aria-label", "Показать все слои зуба");
    header.append(heading, this.showAllButton);

    const list = document.createElement("ul");
    list.className = "tooth-layer-list";
    list.dataset.testid = "layer-list";
    list.setAttribute("aria-label", "Видимость анатомических слоёв");

    for (const part of TOOTH_PART_NAMES) {
      const anatomy = getToothAnatomy(part);
      const row = document.createElement("li");
      row.className = "tooth-layer-row";
      row.dataset.testid = `layer-row-${part}`;
      row.dataset.part = part;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.className = "tooth-layer-checkbox";
      checkbox.dataset.testid = `layer-${part}`;
      checkbox.setAttribute(
        "aria-label",
        `Показывать слой «${anatomy.label}»`,
      );

      const checkboxHitArea = document.createElement("label");
      checkboxHitArea.className = "tooth-layer-checkbox-hit";
      checkboxHitArea.append(checkbox);

      const colorIndicator = document.createElement("span");
      colorIndicator.className = "tooth-color-indicator";
      colorIndicator.style.backgroundColor = anatomy.color;
      colorIndicator.setAttribute("aria-hidden", "true");

      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "tooth-layer-select";
      selectButton.dataset.testid = `layer-select-${part}`;
      selectButton.textContent = anatomy.label;
      selectButton.setAttribute(
        "aria-label",
        `Выбрать анатомический элемент «${anatomy.label}»`,
      );
      selectButton.setAttribute("aria-pressed", "false");

      const onCheckboxChange = (): void => {
        this.callbacks.onVisibilityChange(part, checkbox.checked);
        this.liveStatus.textContent = checkbox.checked
          ? `Слой «${anatomy.label}» показан.`
          : `Слой «${anatomy.label}» скрыт.`;
      };
      const onSelectClick = (): void => {
        this.callbacks.onSelect(part);
        this.liveStatus.textContent = `Выбран элемент «${anatomy.label}».`;
      };

      checkbox.addEventListener("change", onCheckboxChange);
      selectButton.addEventListener("click", onSelectClick);
      row.append(checkboxHitArea, colorIndicator, selectButton);
      list.append(row);
      this.controls.set(part, {
        checkbox,
        selectButton,
        row,
        onCheckboxChange,
        onSelectClick,
      });
    }

    this.liveStatus.className = "tooth-panel-status";
    this.liveStatus.dataset.testid = "layer-status";
    this.liveStatus.setAttribute("role", "status");
    this.liveStatus.setAttribute("aria-live", "polite");
    this.liveStatus.setAttribute("aria-atomic", "true");

    this.showAllButton.addEventListener("click", this.handleShowAllClick);
    this.element.append(header, list, this.liveStatus);
    container.append(this.element);
  }

  public update(state: MaterialState): void {
    for (const part of TOOTH_PART_NAMES) {
      const control = this.controls.get(part);
      if (!control) continue;

      const visible = state.layers[part].visible;
      const selected = state.selectedPart === part;
      control.checkbox.checked = visible;
      control.row.dataset.visible = String(visible);
      control.row.dataset.selected = String(selected);
      control.selectButton.setAttribute("aria-pressed", String(selected));
    }
  }

  public destroy(): void {
    this.showAllButton.removeEventListener("click", this.handleShowAllClick);
    for (const control of this.controls.values()) {
      control.checkbox.removeEventListener("change", control.onCheckboxChange);
      control.selectButton.removeEventListener("click", control.onSelectClick);
    }
    this.controls.clear();
    this.element.remove();
  }

  private readonly handleShowAllClick = (): void => {
    this.callbacks.onShowAll();
    this.liveStatus.textContent = "Все анатомические слои показаны.";
  };
}
