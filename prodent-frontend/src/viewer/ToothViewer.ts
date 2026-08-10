import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  TOOTH_PART_NAMES,
  type ToothPartName,
} from "../data/toothAnatomy";
import { InfoPanel } from "../ui/InfoPanel";
import { LayerPanel } from "../ui/LayerPanel";
import { ViewerInteractions } from "./interactions";
import {
  loadToothModel,
  ToothModelLoadError,
  type LoadedToothModel,
  type ModelLoadProgress,
} from "./loadModel";
import {
  TRANSPARENT_LAYER_OPACITY,
  createInitialMaterialState,
  materialStateReducer,
  type MaterialState,
  type MaterialStateAction,
} from "./materialState";

export interface ToothViewerOptions {
  modelUrl?: string;
  useDemoPlaceholder?: boolean;
  motionEnabled?: boolean;
  pixelRatio?: number;
}

interface MaterialSnapshot {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  color: THREE.Color | null;
  emissive: THREE.Color | null;
  emissiveIntensity: number | null;
}

interface DefaultCameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  near: number;
  far: number;
}

const HIGHLIGHT_COLOR = new THREE.Color("#0b8f87");
const SELECTED_COLOR = new THREE.Color("#00a99d");
const EMPTY_BOX = new THREE.Box3();
const MIN_RENDER_SIZE = 2;
const MAX_PIXEL_RATIO = 1.75;
const DEFAULT_CAMERA_DIRECTION = new THREE.Vector3(0.42, 0.16, 1).normalize();

const EXPLODED_DIRECTIONS: Record<ToothPartName, THREE.Vector3> = {
  Enamel: new THREE.Vector3(1, 0.2, 0.2).normalize(),
  Dentin: new THREE.Vector3(-1, 0.15, -0.1).normalize(),
  Pulp: new THREE.Vector3(0.15, 1, 0).normalize(),
  RootCanal: new THREE.Vector3(-0.1, -1, 0.15).normalize(),
  Cementum: new THREE.Vector3(0.15, -0.2, 1).normalize(),
  PeriodontalLigament: new THREE.Vector3(-0.15, -0.2, -1).normalize(),
};

let viewerSequence = 0;

function mustFind<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing tooth viewer element: ${selector}`);
  return element;
}

function materialList(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function materialColor(material: THREE.Material, key: "color" | "emissive"): THREE.Color | null {
  const value = (material as THREE.Material & Record<string, unknown>)[key];
  return value && typeof value === "object" && (value as THREE.Color).isColor
    ? (value as THREE.Color)
    : null;
}

function materialEmissiveIntensity(material: THREE.Material): number | null {
  const value = (material as THREE.Material & { emissiveIntensity?: unknown }).emissiveIntensity;
  return typeof value === "number" ? value : null;
}

function snapshotMaterial(material: THREE.Material): MaterialSnapshot {
  return {
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    color: materialColor(material, "color")?.clone() ?? null,
    emissive: materialColor(material, "emissive")?.clone() ?? null,
    emissiveIntensity: materialEmissiveIntensity(material),
  };
}

function setEmissiveIntensity(material: THREE.Material, value: number): void {
  if (materialEmissiveIntensity(material) === null) return;
  (material as THREE.Material & { emissiveIntensity: number }).emissiveIntensity = value;
}

function releaseProbeContext(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  context?.getExtension("WEBGL_lose_context")?.loseContext();
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const supported = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    releaseProbeContext(canvas);
    return supported;
  } catch {
    return false;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function modelErrorText(error: unknown, modelUrl: string): string {
  if (error instanceof ToothModelLoadError && error.status === 404) {
    return `3D-модель не найдена по адресу ${modelUrl}. Поместите проверенный GLB-файл в public/models/tooth.glb.`;
  }

  if (error instanceof ToothModelLoadError) {
    return "Не удалось прочитать 3D-модель. Проверьте файл GLB, имена анатомических узлов и файлы декодеров.";
  }

  return "Не удалось запустить 3D-просмотрщик. Обновите страницу или откройте её в современном браузере.";
}

/** Production-oriented, framework-independent Three.js tooth anatomy viewer. */
export class ToothViewer {
  private readonly id = ++viewerSequence;
  private readonly options: Required<
    Pick<ToothViewerOptions, "modelUrl" | "useDemoPlaceholder" | "motionEnabled">
  > & Pick<ToothViewerOptions, "pixelRatio">;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.01, 1000);
  private readonly modelGroup = new THREE.Group();
  private readonly clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly localClippingPlanes = [this.clippingPlane];
  private readonly abortController = new AbortController();
  private readonly clock = new THREE.Clock(false);
  private readonly materialSnapshots = new Map<THREE.Material, MaterialSnapshot>();
  private readonly partMaterials = new Map<ToothPartName, Set<THREE.Material>>();
  private readonly partMeshes = new Map<ToothPartName, Set<THREE.Mesh>>();
  private readonly explodedOrigins = new Map<ToothPartName, THREE.Vector3>();
  private readonly ownedSceneResources: Array<{ dispose: () => void }> = [];
  private readonly cameraFitSize = new THREE.Vector3();
  private readonly cameraOffset = new THREE.Vector3();
  private readonly panTarget = new THREE.Vector3();
  private readonly panCorrection = new THREE.Vector3();
  private readonly keyboardRight = new THREE.Vector3();
  private readonly clippingBounds = new THREE.Box3();
  private readonly viewerElement: HTMLElement;
  private readonly viewportElement: HTMLElement;
  private readonly loadingElement: HTMLElement;
  private readonly loadingProgress: HTMLProgressElement;
  private readonly loadingText: HTMLElement;
  private readonly errorElement: HTMLElement;
  private readonly bannerElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly alternativeElement: HTMLElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly showAllButton: HTMLButtonElement;
  private readonly explodedButton: HTMLButtonElement;
  private readonly autoRotateButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly clippingSlider: HTMLInputElement;
  private readonly clippingOutput: HTMLOutputElement;
  private readonly layerPanel: LayerPanel;
  private readonly infoPanel: InfoPanel;

  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private interactions: ViewerInteractions | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private loadedModel: LoadedToothModel | null = null;
  private environmentTexture: THREE.Texture | null = null;
  private ground: THREE.Mesh | null = null;
  private defaultCamera: DefaultCameraState | null = null;
  private materialState: MaterialState = createInitialMaterialState();
  private hoveredPart: ToothPartName | null = null;
  private modelBounds = new THREE.Box3();
  private modelDiagonal = 1;
  private fittedCameraDistance = 0;
  private maxPanDistance = 0.5;
  private animationFrame = 0;
  private exploded = false;
  private destroyed = false;
  private initialized = false;

  public constructor(
    private readonly container: HTMLElement,
    options: ToothViewerOptions = {},
  ) {
    this.options = {
      modelUrl: options.modelUrl ?? "/models/tooth.glb",
      useDemoPlaceholder: options.useDemoPlaceholder ?? false,
      motionEnabled: options.motionEnabled ?? true,
      pixelRatio: options.pixelRatio,
    };

    const alternativeId = `tooth-model-alternative-${this.id}`;
    const instructionsId = `tooth-model-instructions-${this.id}`;
    container.classList.add("tooth-anatomy-app");
    container.innerHTML = `
      <main class="tooth-viewer" data-testid="tooth-viewer" data-viewer-state="loading">
        <header class="tooth-viewer-header">
          <div>
            <p class="tooth-viewer-eyebrow">PRODENT · АНАТОМИЧЕСКИЙ ПРОСМОТР</p>
            <h1>Строение зуба</h1>
            <p class="tooth-viewer-lead">Поворачивайте модель и изучайте каждый слой отдельно.</p>
          </div>
          <span class="tooth-viewer-format" aria-label="Формат модели GLB, шесть анатомических слоёв">GLB · 6 слоёв</span>
        </header>

        <div class="tooth-viewer-grid">
          <div class="tooth-layers-host" data-testid="layers-host"></div>

          <section class="tooth-stage" id="tooth-viewer-stage" tabindex="-1" aria-label="Область 3D-просмотра">
            <div class="tooth-toolbar" role="toolbar" aria-label="Управление 3D-моделью">
              <button type="button" data-testid="reset-camera" aria-label="Сбросить положение камеры" disabled>Сбросить</button>
              <button type="button" data-testid="show-all" aria-label="Показать все анатомические слои" disabled>Все слои</button>
              <button type="button" data-testid="exploded-view" aria-label="Разнести анатомические слои" aria-pressed="false" disabled>Разнести</button>
              <button type="button" data-testid="auto-rotate" aria-label="Включить автоматическое вращение" aria-pressed="false" disabled>Автовращение</button>
              <button type="button" data-testid="fullscreen" aria-label="Открыть модель на весь экран">На весь экран</button>
            </div>

            <div class="tooth-viewport-shell">
              <div class="tooth-viewport" data-testid="viewer-viewport"></div>
              <div class="tooth-loading" data-testid="loading-indicator" role="status" aria-live="polite">
                <progress max="100"></progress>
                <span>Подготовка 3D-просмотрщика…</span>
              </div>
              <div class="tooth-model-error" data-testid="model-error" role="alert" hidden></div>
              <div class="tooth-demo-banner" data-testid="demo-banner" role="status" hidden></div>
            </div>

            <div class="tooth-clipping-control">
              <div>
                <label for="tooth-clipping-${this.id}">Поперечный разрез</label>
                <output for="tooth-clipping-${this.id}">0%</output>
              </div>
              <input
                id="tooth-clipping-${this.id}"
                data-testid="clipping-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value="0"
                aria-label="Глубина поперечного разреза модели"
                disabled
              />
            </div>

            <p class="tooth-viewer-instructions" id="${instructionsId}">
              Мышь или палец: вращение. Колесо или жест: масштаб. Клавиши-стрелки: вращение, плюс и минус: масштаб, Home: сброс, Escape: снять выбор.
            </p>
          </section>

          <div class="tooth-info-host" data-testid="info-host"></div>
        </div>

        <p class="tooth-model-alternative" id="${alternativeId}">
          Текстовая альтернатива: модель содержит слои эмали, дентина, пульпы, корневого канала, цемента корня и периодонтальной связки. Все слои доступны в панели слева.
        </p>
        <p class="tooth-viewer-status" data-testid="viewer-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </main>
    `;

    this.viewerElement = mustFind(container, "[data-testid='tooth-viewer']");
    this.viewportElement = mustFind(container, "[data-testid='viewer-viewport']");
    this.loadingElement = mustFind(container, "[data-testid='loading-indicator']");
    this.loadingProgress = mustFind(this.loadingElement, "progress");
    this.loadingText = mustFind(this.loadingElement, "span");
    this.errorElement = mustFind(container, "[data-testid='model-error']");
    this.bannerElement = mustFind(container, "[data-testid='demo-banner']");
    this.statusElement = mustFind(container, "[data-testid='viewer-status']");
    this.alternativeElement = mustFind(container, `#${alternativeId}`);
    this.resetButton = mustFind(container, "[data-testid='reset-camera']");
    this.showAllButton = mustFind(container, "[data-testid='show-all']");
    this.explodedButton = mustFind(container, "[data-testid='exploded-view']");
    this.autoRotateButton = mustFind(container, "[data-testid='auto-rotate']");
    this.fullscreenButton = mustFind(container, "[data-testid='fullscreen']");
    this.clippingSlider = mustFind(container, "[data-testid='clipping-slider']");
    this.clippingOutput = mustFind(container, ".tooth-clipping-control output");

    this.layerPanel = new LayerPanel(mustFind(container, "[data-testid='layers-host']"), {
      onVisibilityChange: (part, visible) =>
        this.dispatch({ type: "setVisibility", part, visible }),
      onSelect: (part) => this.dispatch({ type: "select", part }),
      onShowAll: () => this.dispatch({ type: "showAll" }),
    });
    this.infoPanel = new InfoPanel(mustFind(container, "[data-testid='info-host']"), {
      onVisibilityChange: (part, visible) =>
        this.dispatch({ type: "setVisibility", part, visible }),
      onIsolate: (part) => this.dispatch({ type: "isolate", part }),
      onTransparencyChange: (part, transparent) =>
        this.dispatch({ type: "setTransparency", part, transparent }),
    });
    this.layerPanel.update(this.materialState);
    this.infoPanel.update(this.materialState);

    this.resetButton.addEventListener("click", this.handleResetCamera);
    this.showAllButton.addEventListener("click", this.handleShowAll);
    this.explodedButton.addEventListener("click", this.handleExplodedView);
    this.autoRotateButton.addEventListener("click", this.handleAutoRotate);
    this.fullscreenButton.addEventListener("click", this.handleFullscreen);
    this.clippingSlider.addEventListener("input", this.handleClippingInput);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);

    if (!document.fullscreenEnabled || !this.viewerElement.requestFullscreen) {
      this.fullscreenButton.disabled = true;
      this.fullscreenButton.title = "Полноэкранный режим недоступен в этом браузере";
    }
  }

  public async init(): Promise<void> {
    if (this.initialized || this.destroyed) return;
    this.initialized = true;

    // Let the document become interactive before WebGL shader compilation.
    // This keeps navigation responsive on software-rendered CI browsers.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    if (this.destroyed) return;

    if (!supportsWebGL()) {
      this.showError(
        "WebGL недоступен. Откройте страницу в современном браузере и включите аппаратное ускорение.",
      );
      return;
    }

    try {
      this.createRendererAndScene();
      if (!this.renderer) throw new Error("WebGL renderer was not created.");

      const loadedModel = await loadToothModel({
        mock: this.options.useDemoPlaceholder,
        renderer: this.options.useDemoPlaceholder ? undefined : this.renderer,
        url: this.options.modelUrl,
        signal: this.abortController.signal,
        onProgress: this.handleLoadProgress,
      } as Parameters<typeof loadToothModel>[0]);

      if (this.destroyed) {
        loadedModel.dispose();
        return;
      }

      this.loadedModel = loadedModel;
      this.prepareModel(loadedModel);
      this.setReadyState(loadedModel);
      this.startAnimationLoop();
    } catch (error) {
      if (this.destroyed || isAbortError(error)) return;
      this.disposeLoadedModelResources();
      this.showError(modelErrorText(error, this.options.modelUrl));
    }
  }

  /** Restarts rendering after the page is restored from the browser back/forward cache. */
  public resume(): void {
    if (this.destroyed || !this.loadedModel) return;
    this.handleResize();
    this.startAnimationLoop();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abortController.abort();
    this.stopAnimationLoop();

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    this.resetButton.removeEventListener("click", this.handleResetCamera);
    this.showAllButton.removeEventListener("click", this.handleShowAll);
    this.explodedButton.removeEventListener("click", this.handleExplodedView);
    this.autoRotateButton.removeEventListener("click", this.handleAutoRotate);
    this.fullscreenButton.removeEventListener("click", this.handleFullscreen);
    this.clippingSlider.removeEventListener("input", this.handleClippingInput);

    this.interactions?.dispose();
    this.interactions = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.controls) {
      this.controls.removeEventListener("change", this.handleControlsChange);
      this.controls.dispose();
      this.controls = null;
    }

    this.disposeLoadedModelResources();
    this.environmentTexture?.dispose();
    this.environmentTexture = null;

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener("keydown", this.handleCanvasKeyDown);
      canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
      this.renderer.renderLists.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      canvas.remove();
      this.renderer = null;
    }

    this.infoPanel.destroy();
    this.layerPanel.destroy();
    this.scene.clear();
    this.container.replaceChildren();
    this.container.classList.remove("tooth-anatomy-app");
  }

  private disposeLoadedModelResources(): void {
    this.interactions?.setTargets([]);
    for (const material of this.materialSnapshots.keys()) material.dispose();
    this.materialSnapshots.clear();
    this.partMaterials.clear();
    this.partMeshes.clear();
    this.explodedOrigins.clear();

    this.loadedModel?.dispose();
    this.loadedModel = null;
    this.modelGroup.clear();

    this.ground?.removeFromParent();
    this.ground = null;
    for (const resource of this.ownedSceneResources) resource.dispose();
    this.ownedSceneResources.length = 0;

    this.modelBounds.makeEmpty();
    this.clippingBounds.makeEmpty();
    this.defaultCamera = null;
    this.fittedCameraDistance = 0;
  }

  private createRendererAndScene(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    const requestedRatio = this.options.pixelRatio ?? window.devicePixelRatio ?? 1;
    this.renderer.setPixelRatio(THREE.MathUtils.clamp(requestedRatio, 0.75, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor("#e9eff1", 1);

    const canvas = this.renderer.domElement;
    canvas.className = "tooth-canvas";
    canvas.dataset.testid = "viewer-canvas";
    canvas.dataset.selectedPart = "";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Интерактивная 3D-модель анатомических слоёв зуба",
    );
    canvas.setAttribute(
      "aria-describedby",
      `tooth-model-alternative-${this.id} tooth-model-instructions-${this.id}`,
    );
    canvas.addEventListener("keydown", this.handleCanvasKeyDown);
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.viewportElement.append(canvas);

    this.scene.background = new THREE.Color("#e9eff1");
    this.modelGroup.name = "ToothModelRoot";
    this.scene.add(this.modelGroup);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x718087, 1.5);
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    const fill = new THREE.DirectionalLight(0xb9dfe0, 1.25);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.bias = -0.0002;
    fill.position.set(-5, 2, -3);
    this.scene.add(hemi, key, fill);

    // The CI placeholder deliberately avoids PMREM shader compilation. It is
    // non-clinical and is used only for deterministic interaction tests.
    if (!this.options.useDemoPlaceholder) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const environment = new RoomEnvironment();
      this.environmentTexture = pmrem.fromScene(environment, 0.035).texture;
      this.scene.environment = this.environmentTexture;
      environment.dispose();
      pmrem.dispose();
    }

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.55;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(10);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(170);
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.75;
    this.controls.addEventListener("change", this.handleControlsChange);

    this.interactions = new ViewerInteractions(canvas, this.camera, {
      onHover: (part) => this.setHoveredPart(part),
      onSelect: (part) => this.dispatch({ type: "select", part }),
      onInteraction: () => {
        if (this.controls?.autoRotate) this.setAutoRotate(false);
      },
    });

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.viewportElement);
    this.handleResize();
  }

  private prepareModel(model: LoadedToothModel): void {
    model.scene.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(model.scene);
    if (initialBox.isEmpty()) throw new Error("The tooth model does not contain renderable geometry.");

    const center = initialBox.getCenter(new THREE.Vector3());
    model.scene.position.sub(center);
    model.scene.updateMatrixWorld(true);
    this.modelGroup.add(model.scene);
    this.modelBounds = new THREE.Box3().setFromObject(model.scene);
    const size = this.modelBounds.getSize(new THREE.Vector3());
    this.modelDiagonal = Math.max(size.length(), 0.01);
    this.maxPanDistance = this.modelDiagonal * 0.35;

    const sourceMaterials = new Set<THREE.Material>();
    const interactionTargets: THREE.Object3D[] = [];

    for (const part of TOOTH_PART_NAMES) {
      this.partMaterials.set(part, new Set());
      this.partMeshes.set(part, new Set());
      const partObject = model.parts.get(part);
      if (partObject) {
        partObject.userData.anatomyPart = part;
        this.explodedOrigins.set(part, partObject.position.clone());
      }
    }

    model.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      const anatomyPart = this.findPartForObject(mesh);
      if (anatomyPart) {
        mesh.userData.anatomyPart = anatomyPart;
        this.partMeshes.get(anatomyPart)?.add(mesh);
        interactionTargets.push(mesh);
      }

      const clones = materialList(mesh.material).map((source) => {
        sourceMaterials.add(source);
        const clone = source.clone();
        clone.clippingPlanes = null;
        clone.clipShadows = true;
        this.materialSnapshots.set(clone, snapshotMaterial(clone));
        if (anatomyPart) this.partMaterials.get(anatomyPart)?.add(clone);
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    for (const source of sourceMaterials) source.dispose();
    this.interactions?.setTargets(interactionTargets);

    this.createGroundPlane();
    this.fitCameraToModel(true);
    this.updateClippingPlane();
    this.applyMaterialState();
  }

  private findPartForObject(object: THREE.Object3D): ToothPartName | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const value = current.userData.anatomyPart ?? current.userData.anatomyName;
      if (typeof value === "string" && TOOTH_PART_NAMES.includes(value as ToothPartName)) {
        return value as ToothPartName;
      }
      if (current === this.loadedModel?.scene) break;
      current = current.parent;
    }
    return null;
  }

  private createGroundPlane(): void {
    const geometry = new THREE.PlaneGeometry(this.modelDiagonal * 3.2, this.modelDiagonal * 3.2);
    const material = new THREE.ShadowMaterial({
      color: 0x52656a,
      opacity: 0.12,
      transparent: true,
      depthWrite: false,
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = this.modelBounds.min.y - this.modelDiagonal * 0.045;
    ground.receiveShadow = true;
    ground.name = "SoftShadowGround";
    this.scene.add(ground);
    this.ground = ground;
    this.ownedSceneResources.push(geometry, material);
  }

  private fitCameraToModel(resetView: boolean): void {
    if (!this.controls || this.modelBounds.isEmpty()) return;
    const size = this.modelBounds.getSize(this.cameraFitSize);
    const bounds = this.viewportElement.getBoundingClientRect();
    const aspect = Math.max(bounds.width, MIN_RENDER_SIZE) / Math.max(bounds.height, MIN_RENDER_SIZE);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const verticalDistance = size.y / (2 * Math.tan(verticalFov / 2));
    const horizontalDistance = size.x / (2 * Math.tan(horizontalFov / 2));
    const distance = Math.max(verticalDistance, horizontalDistance, size.z * 1.35, 0.4) * 1.35;
    const near = Math.max(distance / 120, 0.005);
    const far = Math.max(distance * 35, this.modelDiagonal * 12);
    const previousFittedDistance = this.fittedCameraDistance;

    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(distance * 0.28, 0.05);
    this.controls.maxDistance = distance * 4;

    this.cameraOffset.copy(this.camera.position).sub(this.controls.target);
    let currentDistance = this.cameraOffset.length();
    if (currentDistance <= Number.EPSILON) {
      this.cameraOffset.copy(DEFAULT_CAMERA_DIRECTION);
      currentDistance = 1;
    }

    if (resetView) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.copy(DEFAULT_CAMERA_DIRECTION).multiplyScalar(distance);
    } else {
      const mustMoveOutward = previousFittedDistance > 0 && distance > previousFittedDistance;
      const minimumDistance = mustMoveOutward ? distance : this.controls.minDistance;
      const safeDistance = THREE.MathUtils.clamp(
        Math.max(currentDistance, minimumDistance),
        this.controls.minDistance,
        this.controls.maxDistance,
      );
      this.cameraOffset.setLength(safeDistance);
      this.camera.position.copy(this.controls.target).add(this.cameraOffset);
    }

    this.controls.update();
    this.defaultCamera = {
      position: DEFAULT_CAMERA_DIRECTION.clone().multiplyScalar(distance),
      target: new THREE.Vector3(),
      near,
      far,
    };
    this.fittedCameraDistance = distance;
  }

  private dispatch(action: MaterialStateAction): void {
    const next = materialStateReducer(this.materialState, action);
    if (next === this.materialState) return;
    this.materialState = next;
    if (this.renderer) {
      this.renderer.domElement.dataset.selectedPart = next.selectedPart ?? "";
    }
    this.layerPanel.update(next);
    this.infoPanel.update(next);
    this.applyMaterialState();
  }

  private applyMaterialState(): void {
    for (const part of TOOTH_PART_NAMES) {
      const layerState = this.materialState.layers[part];
      for (const mesh of this.partMeshes.get(part) ?? []) mesh.visible = layerState.visible;

      const isSelected = this.materialState.selectedPart === part;
      const isHovered = !isSelected && this.hoveredPart === part;
      for (const material of this.partMaterials.get(part) ?? []) {
        const snapshot = this.materialSnapshots.get(material);
        if (!snapshot) continue;

        material.opacity = layerState.transparent
          ? Math.min(snapshot.opacity, TRANSPARENT_LAYER_OPACITY)
          : snapshot.opacity;
        material.transparent = snapshot.transparent || layerState.transparent;
        material.depthWrite = layerState.transparent ? false : snapshot.depthWrite;

        const color = materialColor(material, "color");
        if (color && snapshot.color) {
          color.copy(snapshot.color);
          if (isSelected) color.lerp(SELECTED_COLOR, 0.22);
          else if (isHovered) color.lerp(HIGHLIGHT_COLOR, 0.12);
        }

        const emissive = materialColor(material, "emissive");
        if (emissive && snapshot.emissive) {
          emissive.copy(snapshot.emissive);
          if (isSelected) emissive.lerp(SELECTED_COLOR, 0.75);
          else if (isHovered) emissive.lerp(HIGHLIGHT_COLOR, 0.5);
        }
        if (snapshot.emissiveIntensity !== null) {
          setEmissiveIntensity(
            material,
            isSelected ? 0.55 : isHovered ? 0.3 : snapshot.emissiveIntensity,
          );
        }
      }
    }
  }

  private setHoveredPart(part: ToothPartName | null): void {
    if (part === this.hoveredPart) return;
    this.hoveredPart = part;
    this.applyMaterialState();
  }

  private setReadyState(model: LoadedToothModel): void {
    this.loadingElement.hidden = true;
    this.errorElement.hidden = true;
    this.viewerElement.dataset.viewerState = "ready";
    this.resetButton.disabled = false;
    this.showAllButton.disabled = false;
    this.explodedButton.disabled = false;
    this.autoRotateButton.disabled = false;
    this.clippingSlider.disabled = false;

    if (model.banner) {
      this.bannerElement.hidden = false;
      this.bannerElement.textContent = model.banner.text;
      this.bannerElement.setAttribute("aria-label", model.banner.ariaLabel);
      this.alternativeElement.textContent = `${model.banner.ariaLabel} Доступные тестовые слои: ${TOOTH_PART_NAMES.join(", ")}.`;
    } else if (model.missingNodeNames.length > 0) {
      const missing = model.missingNodeNames.join(", ");
      this.bannerElement.hidden = false;
      this.bannerElement.textContent = `МОДЕЛЬ ЗАГРУЖЕНА НЕ ПОЛНОСТЬЮ · НЕТ: ${missing}`;
      this.bannerElement.setAttribute(
        "aria-label",
        `В предоставленной модели отсутствуют обязательные слои: ${missing}.`,
      );
      this.alternativeElement.textContent = `Предоставленная 3D-модель зуба загружена не полностью. Отсутствуют слои: ${missing}.`;
    } else {
      this.bannerElement.hidden = true;
      this.bannerElement.removeAttribute("aria-label");
      this.alternativeElement.textContent = "Предоставленная 3D-модель зуба. Доступные слои перечислены в панели слева. Медицинская точность определяется проверкой исходного GLB-ассета.";
    }

    this.statusElement.textContent = model.mode === "provided-model"
      ? "Предоставленная 3D-модель загружена."
      : "Демонстрационный placeholder загружен. Это не клиническая модель.";
  }

  private showError(message: string): void {
    this.stopAnimationLoop();
    this.loadingElement.hidden = true;
    this.errorElement.hidden = false;
    this.errorElement.textContent = message;
    this.viewerElement.dataset.viewerState = "error";
    this.statusElement.textContent = message;
    this.alternativeElement.textContent = `${message} Текстовое описание слоёв доступно в панели слева.`;
  }

  private readonly handleLoadProgress = (progress: ModelLoadProgress): void => {
    if (this.destroyed) return;
    this.loadingElement.hidden = false;
    if (progress.ratio === null) this.loadingProgress.removeAttribute("value");
    else this.loadingProgress.value = Math.round(progress.ratio * 100);

    if (progress.stage === "download") {
      this.loadingText.textContent = progress.ratio === null
        ? "Загрузка модели…"
        : `Загрузка модели: ${Math.round(progress.ratio * 100)}%`;
    } else if (progress.stage === "decode") {
      this.loadingText.textContent = "Подготовка материалов и геометрии…";
    } else {
      this.loadingText.textContent = "Модель готова.";
    }
  };

  private readonly handleResize = (): void => {
    if (!this.renderer) return;
    const bounds = this.viewportElement.getBoundingClientRect();
    const width = Math.max(Math.round(bounds.width), MIN_RENDER_SIZE);
    const height = Math.max(Math.round(bounds.height), MIN_RENDER_SIZE);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.loadedModel && !this.modelBounds.isEmpty()) {
      this.fitCameraToModel(false);
    }
  };

  private readonly handleControlsChange = (): void => {
    if (!this.controls) return;
    if (this.controls.target.length() > this.maxPanDistance) {
      this.panTarget.copy(this.controls.target).setLength(this.maxPanDistance);
      this.panCorrection.copy(this.panTarget).sub(this.controls.target);
      this.controls.target.copy(this.panTarget);
      this.camera.position.add(this.panCorrection);
    }
  };

  private readonly handleResetCamera = (): void => {
    if (!this.defaultCamera || !this.controls) return;
    this.camera.position.copy(this.defaultCamera.position);
    this.camera.near = this.defaultCamera.near;
    this.camera.far = this.defaultCamera.far;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(this.defaultCamera.target);
    this.controls.update();
    this.statusElement.textContent = "Камера сброшена.";
  };

  private readonly handleShowAll = (): void => {
    this.dispatch({ type: "showAll" });
    this.statusElement.textContent = "Все анатомические слои показаны.";
  };

  private readonly handleExplodedView = (): void => {
    this.exploded = !this.exploded;
    const distance = this.modelDiagonal * 0.16;
    for (const part of TOOTH_PART_NAMES) {
      const object = this.loadedModel?.parts.get(part);
      const origin = this.explodedOrigins.get(part);
      if (!object || !origin) continue;
      object.position.copy(origin);
      if (this.exploded) object.position.addScaledVector(EXPLODED_DIRECTIONS[part], distance);
    }
    this.loadedModel?.scene.updateMatrixWorld(true);
    this.updateClippingPlane();
    this.explodedButton.setAttribute("aria-pressed", String(this.exploded));
    this.explodedButton.textContent = this.exploded ? "Собрать" : "Разнести";
    this.statusElement.textContent = this.exploded
      ? "Анатомические слои разнесены."
      : "Анатомические слои собраны.";
  };

  private readonly handleAutoRotate = (): void => {
    this.setAutoRotate(!this.controls?.autoRotate);
  };

  private setAutoRotate(enabled: boolean): void {
    if (!this.controls) return;
    this.controls.autoRotate = enabled;
    this.autoRotateButton.setAttribute("aria-pressed", String(enabled));
    this.autoRotateButton.textContent = enabled ? "Остановить" : "Автовращение";
    this.statusElement.textContent = enabled
      ? "Автоматическое вращение включено."
      : "Автоматическое вращение выключено.";
  }

  private readonly handleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement === this.viewerElement) {
        await document.exitFullscreen();
      } else if (this.viewerElement.requestFullscreen) {
        await this.viewerElement.requestFullscreen();
      }
    } catch {
      this.statusElement.textContent = "Браузер не разрешил полноэкранный режим.";
    }
  };

  private readonly handleFullscreenChange = (): void => {
    const active = document.fullscreenElement === this.viewerElement;
    this.fullscreenButton.textContent = active ? "Выйти" : "На весь экран";
    this.fullscreenButton.setAttribute("aria-pressed", String(active));
    this.handleResize();
  };

  private readonly handleClippingInput = (): void => {
    this.updateClippingPlane();
    const value = Number(this.clippingSlider.value);
    this.clippingOutput.value = `${value}%`;
    this.clippingSlider.setAttribute("aria-valuetext", `Глубина разреза ${value} процентов`);
    this.statusElement.textContent = value === 0
      ? "Поперечный разрез выключен."
      : `Глубина поперечного разреза: ${value}%.`;
  };

  private updateClippingPlane(): void {
    const ratio = Number(this.clippingSlider.value) / 100;
    const clippingEnabled = ratio > 0;
    for (const material of this.materialSnapshots.keys()) {
      const materialClippingEnabled = (material.clippingPlanes?.length ?? 0) > 0;
      if (materialClippingEnabled === clippingEnabled) continue;
      material.clippingPlanes = clippingEnabled ? this.localClippingPlanes : null;
      material.needsUpdate = true;
    }

    if (!clippingEnabled || !this.loadedModel) return;
    this.clippingBounds.setFromObject(this.loadedModel.scene);
    if (this.clippingBounds.equals(EMPTY_BOX) || this.clippingBounds.isEmpty()) return;

    const planeY = THREE.MathUtils.lerp(
      this.clippingBounds.min.y - this.modelDiagonal * 0.01,
      this.clippingBounds.max.y + this.modelDiagonal * 0.01,
      ratio,
    );
    this.clippingPlane.constant = -planeY;
  }

  private readonly handleCanvasKeyDown = (event: KeyboardEvent): void => {
    if (!this.controls) return;
    const offset = this.cameraOffset.copy(this.camera.position).sub(this.controls.target);
    let handled = true;

    switch (event.key) {
      case "Escape":
        this.dispatch({ type: "select", part: null });
        this.statusElement.textContent = "Выбор снят.";
        break;
      case "Home":
        this.handleResetCamera();
        break;
      case "+":
      case "=":
        offset.setLength(
          THREE.MathUtils.clamp(
            offset.length() * 0.88,
            this.controls.minDistance,
            this.controls.maxDistance,
          ),
        );
        this.camera.position.copy(this.controls.target).add(offset);
        this.controls.update();
        break;
      case "-":
      case "_":
        offset.setLength(
          THREE.MathUtils.clamp(
            offset.length() * 1.12,
            this.controls.minDistance,
            this.controls.maxDistance,
          ),
        );
        this.camera.position.copy(this.controls.target).add(offset);
        this.controls.update();
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        const direction = event.key === "ArrowLeft" ? 1 : -1;
        offset.applyAxisAngle(this.camera.up, direction * THREE.MathUtils.degToRad(6));
        this.camera.position.copy(this.controls.target).add(offset);
        this.controls.update();
        break;
      }
      case "ArrowUp":
      case "ArrowDown": {
        const right = this.keyboardRight.crossVectors(offset, this.camera.up).normalize();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        offset.applyAxisAngle(right, direction * THREE.MathUtils.degToRad(5));
        this.camera.position.copy(this.controls.target).add(offset);
        this.controls.update();
        break;
      }
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.stopAnimationLoop();
    else this.startAnimationLoop();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopAnimationLoop();
    this.statusElement.textContent = "Графический контекст временно потерян. Ожидается восстановление.";
  };

  private readonly handleContextRestored = (): void => {
    this.statusElement.textContent = "Графический контекст восстановлен.";
    this.startAnimationLoop();
  };

  private startAnimationLoop(): void {
    if (this.animationFrame || this.destroyed || document.hidden || !this.renderer) return;
    this.clock.start();
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.clock.stop();
  }

  private readonly renderFrame = (): void => {
    this.animationFrame = 0;
    if (this.destroyed || document.hidden || !this.renderer) return;
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (this.options.motionEnabled || this.controls?.autoRotate) this.controls?.update(delta);
    else this.controls?.update(0);
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  };
}
