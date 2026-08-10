import {
  getToothAnatomy,
  type ToothPartName,
} from "../data/toothAnatomy";
import type { MaterialState } from "../viewer/materialState";

export interface InfoPanelCallbacks {
  readonly onVisibilityChange: (
    part: ToothPartName,
    visible: boolean,
  ) => void;
  readonly onIsolate: (part: ToothPartName) => void;
  readonly onTransparencyChange: (
    part: ToothPartName,
    transparent: boolean,
  ) => void;
}

let infoPanelSequence = 0;

function createActionButton(testId: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.testid = testId;
  return button;
}

export class InfoPanel {
  public readonly element: HTMLElement;

  private readonly emptyState = document.createElement("p");
  private readonly content = document.createElement("div");
  private readonly title = document.createElement("h3");
  private readonly nodeName = document.createElement("code");
  private readonly description = document.createElement("p");
  private readonly colorIndicator = document.createElement("span");
  private readonly colorText = document.createElement("span");
  private readonly visibilityButton = createActionButton(
    "info-toggle-visibility",
  );
  private readonly isolateButton = createActionButton("info-isolate");
  private readonly transparencyButton = createActionButton(
    "info-toggle-transparency",
  );
  private readonly liveStatus = document.createElement("p");
  private currentState: MaterialState | null = null;

  public constructor(
    container: HTMLElement,
    private readonly callbacks: InfoPanelCallbacks,
  ) {
    const panelId = `tooth-info-panel-title-${++infoPanelSequence}`;

    this.element = document.createElement("aside");
    this.element.className = "tooth-info-panel";
    this.element.dataset.testid = "info-panel";
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "Сведения об анатомическом элементе");

    const heading = document.createElement("h2");
    heading.id = panelId;
    heading.textContent = "Анатомический элемент";
    heading.className = "tooth-panel-heading";
    this.element.setAttribute("aria-labelledby", panelId);

    this.emptyState.className = "tooth-info-empty";
    this.emptyState.dataset.testid = "info-empty";
    this.emptyState.textContent =
      "Выберите часть зуба на модели или в списке слоёв.";

    this.content.className = "tooth-info-content";
    this.content.dataset.testid = "info-content";
    this.content.hidden = true;

    this.title.className = "tooth-info-title";
    this.title.dataset.testid = "info-title";

    const nodeRow = document.createElement("p");
    nodeRow.className = "tooth-info-node";
    const nodeLabel = document.createElement("span");
    nodeLabel.textContent = "Узел модели: ";
    this.nodeName.dataset.testid = "info-node-name";
    nodeRow.append(nodeLabel, this.nodeName);

    this.description.className = "tooth-info-description";
    this.description.dataset.testid = "info-description";

    const colorRow = document.createElement("div");
    colorRow.className = "tooth-info-color";
    colorRow.dataset.testid = "info-color";
    this.colorIndicator.className = "tooth-color-indicator";
    this.colorIndicator.setAttribute("aria-hidden", "true");
    colorRow.append(this.colorIndicator, this.colorText);

    const actions = document.createElement("div");
    actions.className = "tooth-info-actions";
    this.isolateButton.textContent = "Изолировать";
    actions.append(
      this.visibilityButton,
      this.isolateButton,
      this.transparencyButton,
    );

    this.liveStatus.className = "tooth-panel-status";
    this.liveStatus.dataset.testid = "info-status";
    this.liveStatus.setAttribute("role", "status");
    this.liveStatus.setAttribute("aria-live", "polite");
    this.liveStatus.setAttribute("aria-atomic", "true");

    this.content.append(
      this.title,
      nodeRow,
      this.description,
      colorRow,
      actions,
    );
    this.element.append(heading, this.emptyState, this.content, this.liveStatus);
    container.append(this.element);

    this.visibilityButton.addEventListener("click", this.handleVisibilityClick);
    this.isolateButton.addEventListener("click", this.handleIsolateClick);
    this.transparencyButton.addEventListener(
      "click",
      this.handleTransparencyClick,
    );
  }

  public update(state: MaterialState): void {
    this.currentState = state;
    const part = state.selectedPart;

    if (part === null) {
      this.emptyState.hidden = false;
      this.content.hidden = true;
      this.liveStatus.textContent = "Анатомический элемент не выбран.";
      return;
    }

    const anatomy = getToothAnatomy(part);
    const layerState = state.layers[part];
    this.emptyState.hidden = true;
    this.content.hidden = false;
    this.content.dataset.part = part;
    this.title.textContent = anatomy.label;
    this.nodeName.textContent = anatomy.nodeName;
    this.description.textContent = anatomy.description;
    this.colorIndicator.style.backgroundColor = anatomy.color;
    this.colorText.textContent = `Цветовой индикатор: ${anatomy.color}`;

    const visibilityAction = layerState.visible ? "Скрыть" : "Показать";
    this.visibilityButton.textContent = visibilityAction;
    this.visibilityButton.setAttribute(
      "aria-label",
      `${visibilityAction} слой «${anatomy.label}»`,
    );
    this.visibilityButton.setAttribute(
      "aria-pressed",
      String(!layerState.visible),
    );

    this.isolateButton.setAttribute(
      "aria-label",
      `Показать только слой «${anatomy.label}»`,
    );
    this.isolateButton.setAttribute(
      "aria-pressed",
      String(state.isolatedPart === part),
    );

    const transparencyAction = layerState.transparent
      ? "Сделать непрозрачным"
      : "Сделать прозрачным";
    this.transparencyButton.textContent = transparencyAction;
    this.transparencyButton.setAttribute(
      "aria-label",
      `${transparencyAction} слой «${anatomy.label}»`,
    );
    this.transparencyButton.setAttribute(
      "aria-pressed",
      String(layerState.transparent),
    );
    this.liveStatus.textContent = `Выбран элемент «${anatomy.label}».`;
  }

  public destroy(): void {
    this.visibilityButton.removeEventListener(
      "click",
      this.handleVisibilityClick,
    );
    this.isolateButton.removeEventListener("click", this.handleIsolateClick);
    this.transparencyButton.removeEventListener(
      "click",
      this.handleTransparencyClick,
    );
    this.currentState = null;
    this.element.remove();
  }

  private readonly handleVisibilityClick = (): void => {
    const part = this.currentState?.selectedPart;
    if (!part || !this.currentState) return;

    const visible = !this.currentState.layers[part].visible;
    this.callbacks.onVisibilityChange(part, visible);
    const anatomy = getToothAnatomy(part);
    this.liveStatus.textContent = visible
      ? `Слой «${anatomy.label}» показан.`
      : `Слой «${anatomy.label}» скрыт.`;
  };

  private readonly handleIsolateClick = (): void => {
    const part = this.currentState?.selectedPart;
    if (!part) return;

    this.callbacks.onIsolate(part);
    this.liveStatus.textContent = `Изолирован слой «${getToothAnatomy(part).label}».`;
  };

  private readonly handleTransparencyClick = (): void => {
    const part = this.currentState?.selectedPart;
    if (!part || !this.currentState) return;

    const transparent = !this.currentState.layers[part].transparent;
    this.callbacks.onTransparencyChange(part, transparent);
    const anatomy = getToothAnatomy(part);
    this.liveStatus.textContent = transparent
      ? `Слой «${anatomy.label}» сделан прозрачным.`
      : `Слой «${anatomy.label}» сделан непрозрачным.`;
  };
}
