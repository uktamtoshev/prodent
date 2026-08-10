import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  TOOTH_PART_NAMES,
  type ToothPartName,
} from "../data/toothAnatomy";

export const TOOTH_ANATOMY_NODE_NAMES = TOOTH_PART_NAMES;

export type ToothAnatomyNodeName = ToothPartName;
export type LoadedModelMode = "provided-model" | "demo-placeholder";
export type ModelLoadStage = "download" | "decode" | "complete";

export interface ModelLoadProgress {
  stage: ModelLoadStage;
  loaded: number;
  total: number | null;
  ratio: number | null;
}

export interface ModelBannerContract {
  kind: "demo-placeholder";
  role: "status";
  persistent: true;
  text: string;
  ariaLabel: string;
}

export interface LoadedToothModel {
  mode: LoadedModelMode;
  scene: THREE.Group;
  parts: ReadonlyMap<ToothAnatomyNodeName, THREE.Object3D>;
  missingNodeNames: readonly ToothAnatomyNodeName[];
  banner: ModelBannerContract | null;
  animations: readonly THREE.AnimationClip[];
  dispose: () => void;
}

interface BaseLoadModelOptions {
  url?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ModelLoadProgress) => void;
  dracoDecoderPath?: string;
  ktx2TranscoderPath?: string;
  requestTimeoutMs?: number;
}

export type LoadModelOptions =
  | (BaseLoadModelOptions & {
      mock: true;
      renderer?: THREE.WebGLRenderer;
    })
  | (BaseLoadModelOptions & {
      mock?: false;
      renderer: THREE.WebGLRenderer;
    });

const DEFAULT_MODEL_URL = "/models/tooth.glb";
const DEFAULT_DRACO_DECODER_PATH = "/decoders/draco/";
const DEFAULT_KTX2_TRANSCODER_PATH = "/decoders/basis/";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const EXPECTED_NODE_NAME_SET = new Set<string>(TOOTH_ANATOMY_NODE_NAMES);

type KTX2LoaderInternals = KTX2Loader & {
  transcoderPending?: Promise<unknown> | null;
};

export class ToothModelLoadError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ToothModelLoadError";
    this.status = status;
  }
}

function createAbortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Model loading was cancelled.", "AbortError");
  }

  const error = new Error("Model loading was cancelled.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function reportProgress(
  callback: LoadModelOptions["onProgress"],
  progress: ModelLoadProgress,
): void {
  if (!callback) return;

  try {
    callback(progress);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[tooth-viewer] Progress callback failed.", error);
    }
  }
}

function downloadArrayBuffer(
  url: string,
  signal: AbortSignal | undefined,
  onProgress: LoadModelOptions["onProgress"],
  timeoutMs: number,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      request.onload = null;
      request.onerror = null;
      request.onabort = null;
      request.ontimeout = null;
      request.onprogress = null;
      signal?.removeEventListener("abort", handleSignalAbort);
    };

    const succeed = (buffer: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(buffer);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleSignalAbort = () => {
      request.abort();
      fail(createAbortError());
    };

    if (signal?.aborted) {
      fail(createAbortError());
      return;
    }

    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.timeout = Math.max(1_000, timeoutMs);

    request.onprogress = (event) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : null;
      reportProgress(onProgress, {
        stage: "download",
        loaded: event.loaded,
        total,
        ratio: total === null ? null : Math.min(event.loaded / total, 1),
      });
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        fail(
          new ToothModelLoadError(
            `Unable to load the tooth model (HTTP ${request.status}).`,
            request.status,
          ),
        );
        return;
      }

      if (!(request.response instanceof ArrayBuffer)) {
        fail(new ToothModelLoadError("The tooth model response is not a binary GLB file."));
        return;
      }

      succeed(request.response);
    };

    request.onerror = () => {
      fail(new ToothModelLoadError("A network error occurred while loading the tooth model."));
    };

    request.ontimeout = () => {
      fail(new ToothModelLoadError("The tooth model download timed out."));
    };

    request.onabort = () => fail(createAbortError());
    signal?.addEventListener("abort", handleSignalAbort, { once: true });

    reportProgress(onProgress, {
      stage: "download",
      loaded: 0,
      total: null,
      ratio: null,
    });
    request.send();
  });
}

function resourcePathFor(modelUrl: string): string {
  if (typeof document !== "undefined") {
    try {
      return new URL(".", new URL(modelUrl, document.baseURI)).href;
    } catch {
      // Fall through to a path-only calculation for non-standard test URLs.
    }
  }

  const cleanUrl = modelUrl.split("#", 1)[0].split("?", 1)[0];
  const slashIndex = cleanUrl.lastIndexOf("/");
  return slashIndex >= 0 ? cleanUrl.slice(0, slashIndex + 1) : "./";
}

function originalNodeName(object: THREE.Object3D): string {
  const gltfName = object.userData?.name;
  return typeof gltfName === "string" && gltfName.length > 0 ? gltfName : object.name;
}

function findAnatomyParts(scene: THREE.Group): {
  parts: Map<ToothAnatomyNodeName, THREE.Object3D>;
  missingNodeNames: ToothAnatomyNodeName[];
} {
  const matches = new Map<ToothAnatomyNodeName, THREE.Object3D[]>();

  scene.traverse((object) => {
    const sourceNodeName = originalNodeName(object);
    if (sourceNodeName) object.userData.sourceNodeName = sourceNodeName;

    if (!EXPECTED_NODE_NAME_SET.has(sourceNodeName)) return;
    const anatomyName = sourceNodeName as ToothAnatomyNodeName;
    const existing = matches.get(anatomyName);
    if (existing) existing.push(object);
    else matches.set(anatomyName, [object]);
  });

  const parts = new Map<ToothAnatomyNodeName, THREE.Object3D>();
  const missingNodeNames: ToothAnatomyNodeName[] = [];

  for (const name of TOOTH_ANATOMY_NODE_NAMES) {
    const nodes = matches.get(name) ?? [];
    if (nodes.length === 0) {
      missingNodeNames.push(name);
      continue;
    }

    const part = nodes[0];
    part.userData.anatomyName = name;
    part.userData.anatomyPart = name;
    parts.set(name, part);

    if (nodes.length > 1 && import.meta.env.DEV) {
      console.warn(
        `[tooth-viewer] Expected one node named "${name}", found ${nodes.length}. The first node will be used.`,
      );
    }
  }

  // Raycasting usually hits a descendant mesh. Tag it with the closest exact
  // anatomical ancestor instead of guessing from material, color, or position.
  scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;

    let current: THREE.Object3D | null = object;
    while (current) {
      const sourceNodeName = originalNodeName(current);
      if (EXPECTED_NODE_NAME_SET.has(sourceNodeName)) {
        object.userData.anatomyName = sourceNodeName as ToothAnatomyNodeName;
        object.userData.anatomyPart = sourceNodeName as ToothAnatomyNodeName;
        break;
      }
      if (current === scene) break;
      current = current.parent;
    }
  });

  if (missingNodeNames.length > 0 && import.meta.env.DEV) {
    console.warn(
      `[tooth-viewer] The GLB is missing expected nodes: ${missingNodeNames.join(", ")}.`,
    );
  }

  return { parts, missingNodeNames };
}

function collectMaterialTextures(material: THREE.Material, textures: Set<THREE.Texture>): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
      textures.add(value as THREE.Texture);
    }
  }

  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (!uniforms) return;

  for (const uniform of Object.values(uniforms)) {
    const value = uniform?.value;
    if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
      textures.add(value as THREE.Texture);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && (item as THREE.Texture).isTexture) {
          textures.add(item as THREE.Texture);
        }
      }
    }
  }
}

function closeTextureImage(texture: THREE.Texture, closedImages: Set<unknown>): void {
  if (typeof ImageBitmap === "undefined") return;
  const sourceData = texture.source?.data;
  const candidates = Array.isArray(sourceData) ? sourceData : [sourceData];

  for (const image of candidates) {
    if (image instanceof ImageBitmap && !closedImages.has(image)) {
      closedImages.add(image);
      image.close();
    }
  }
}

/** Disposes resources owned by one loaded model. It does not dispose the renderer. */
export function disposeObject3DResources(
  roots: THREE.Object3D | readonly THREE.Object3D[],
): void {
  const rootList: readonly THREE.Object3D[] = Array.isArray(roots)
    ? roots
    : [roots as THREE.Object3D];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const closedImages = new Set<unknown>();

  for (const root of rootList) {
    root.removeFromParent();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.geometry) geometries.add(mesh.geometry);
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of meshMaterials) {
          if (!material) continue;
          materials.add(material);
          collectMaterialTextures(material, textures);
        }
      }

      const skinnedMesh = object as THREE.SkinnedMesh;
      if (skinnedMesh.isSkinnedMesh && skinnedMesh.skeleton.boneTexture) {
        textures.add(skinnedMesh.skeleton.boneTexture);
      }
    });
  }

  for (const texture of textures) {
    texture.dispose();
    closeTextureImage(texture, closedImages);
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const root of rootList) root.clear();
}

function uniqueGltfScenes(gltf: GLTF): THREE.Group[] {
  return Array.from(new Set([gltf.scene, ...gltf.scenes]));
}

function createProvidedModelResult(gltf: GLTF): LoadedToothModel {
  const { parts, missingNodeNames } = findAnatomyParts(gltf.scene);
  const scenes = uniqueGltfScenes(gltf);
  let disposed = false;

  gltf.scene.userData.modelMode = "provided-model";
  gltf.scene.userData.missingAnatomyNodes = [...missingNodeNames];

  return {
    mode: "provided-model",
    scene: gltf.scene,
    parts,
    missingNodeNames: Object.freeze([...missingNodeNames]),
    banner: null,
    animations: gltf.animations,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObject3DResources(scenes);
      parts.clear();
    },
  };
}

function disposeLoaderWorkers(dracoLoader: DRACOLoader, ktx2Loader: KTX2Loader): void {
  dracoLoader.dispose();

  // KTX2Loader r160 decrements a global counter in dispose(), even when init()
  // was never called. Only dispose an initialized transcoder instance.
  if ((ktx2Loader as KTX2LoaderInternals).transcoderPending) {
    ktx2Loader.dispose();
  }
}

function waitForPromiseOrAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

export async function loadModel(options: LoadModelOptions): Promise<LoadedToothModel> {
  throwIfAborted(options.signal);

  if (options.mock === true) {
    const { createDemoPlaceholder } = await import("./demoPlaceholder");
    throwIfAborted(options.signal);
    const placeholder = createDemoPlaceholder();
    reportProgress(options.onProgress, {
      stage: "complete",
      loaded: 1,
      total: 1,
      ratio: 1,
    });
    return placeholder;
  }

  const modelUrl = options.url ?? DEFAULT_MODEL_URL;
  const manager = new THREE.LoadingManager();
  const dracoLoader = new DRACOLoader(manager)
    .setDecoderPath(options.dracoDecoderPath ?? DEFAULT_DRACO_DECODER_PATH)
    .setWorkerLimit(2);
  const ktx2Loader = new KTX2Loader(manager)
    .setTranscoderPath(options.ktx2TranscoderPath ?? DEFAULT_KTX2_TRANSCODER_PATH)
    .setWorkerLimit(2)
    .detectSupport(options.renderer);
  const gltfLoader = new GLTFLoader(manager)
    .setDRACOLoader(dracoLoader)
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder);

  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    reportProgress(options.onProgress, {
      stage: "decode",
      loaded: itemsLoaded,
      total: itemsTotal > 0 ? itemsTotal : null,
      ratio: itemsTotal > 0 ? Math.min(itemsLoaded / itemsTotal, 1) : null,
    });
  };

  let parsePromise: Promise<GLTF> | null = null;
  let parsedGltfAwaitingOwnership: GLTF | null = null;
  let cleanupDeferredUntilParseSettles = false;

  try {
    const buffer = await downloadArrayBuffer(
      modelUrl,
      options.signal,
      options.onProgress,
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    );
    throwIfAborted(options.signal);
    reportProgress(options.onProgress, {
      stage: "decode",
      loaded: 0,
      total: null,
      ratio: null,
    });

    parsePromise = gltfLoader.parseAsync(buffer, resourcePathFor(modelUrl));

    let gltf: GLTF;
    try {
      gltf = await waitForPromiseOrAbort(parsePromise, options.signal);
    } catch (error) {
      if (isAbortError(error)) {
        cleanupDeferredUntilParseSettles = true;
        void parsePromise
          .then((lateGltf) => disposeObject3DResources(uniqueGltfScenes(lateGltf)))
          .catch(() => undefined)
          .finally(() => disposeLoaderWorkers(dracoLoader, ktx2Loader));
      }
      throw error;
    }

    parsedGltfAwaitingOwnership = gltf;
    throwIfAborted(options.signal);
    const result = createProvidedModelResult(gltf);
    parsedGltfAwaitingOwnership = null;
    reportProgress(options.onProgress, {
      stage: "complete",
      loaded: 1,
      total: 1,
      ratio: 1,
    });
    return result;
  } catch (error) {
    if (parsedGltfAwaitingOwnership) {
      disposeObject3DResources(uniqueGltfScenes(parsedGltfAwaitingOwnership));
      parsedGltfAwaitingOwnership = null;
    }
    if (isAbortError(error) || error instanceof ToothModelLoadError) throw error;
    throw new ToothModelLoadError(
      error instanceof Error ? `Unable to parse the tooth model: ${error.message}` : "Unable to parse the tooth model.",
    );
  } finally {
    manager.onProgress = () => undefined;
    if (!cleanupDeferredUntilParseSettles) {
      disposeLoaderWorkers(dracoLoader, ktx2Loader);
    }
  }
}

export const loadToothModel = loadModel;
