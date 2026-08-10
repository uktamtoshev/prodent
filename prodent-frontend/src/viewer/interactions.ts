import * as THREE from "three";
import type { ToothPartName } from "../data/toothAnatomy";

export interface ViewerInteractionCallbacks {
  onHover: (part: ToothPartName | null) => void;
  onSelect: (part: ToothPartName | null) => void;
  onInteraction?: () => void;
}

interface PointerOrigin {
  pointerId: number;
  x: number;
  y: number;
}

const DRAG_THRESHOLD_PX = 6;

function findAnatomyPart(object: THREE.Object3D | null): ToothPartName | null {
  let current = object;

  while (current) {
    const part = current.userData.anatomyPart ?? current.userData.anatomyName;
    if (typeof part === "string") return part as ToothPartName;
    current = current.parent;
  }

  return null;
}

function isVisibleInHierarchy(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function materialForIntersection(
  intersection: THREE.Intersection,
): THREE.Material | null {
  const mesh = intersection.object as THREE.Mesh;
  if (!mesh.isMesh || !mesh.material) return null;
  if (!Array.isArray(mesh.material)) return mesh.material;

  const materialIndex = intersection.face?.materialIndex ?? 0;
  return mesh.material[materialIndex] ?? mesh.material[0] ?? null;
}

function isClipped(point: THREE.Vector3, material: THREE.Material): boolean {
  const planes = material.clippingPlanes;
  if (!planes || planes.length === 0) return false;

  // Three.js discards the negative half-space of a local clipping plane.
  const outside = (plane: THREE.Plane): boolean => plane.distanceToPoint(point) < 0;
  return material.clipIntersection
    ? planes.every(outside)
    : planes.some(outside);
}

function isPickable(intersection: THREE.Intersection): boolean {
  if (!isVisibleInHierarchy(intersection.object)) return false;
  const material = materialForIntersection(intersection);
  if (!material || !material.visible || material.opacity <= 0.001) return false;
  return !isClipped(intersection.point, material);
}

/**
 * Pointer interaction layer kept outside the render loop. Pointer-move picking
 * is throttled to one Raycaster pass per animation frame.
 */
export class ViewerInteractions {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private targets: THREE.Object3D[] = [];
  private pointerOrigin: PointerOrigin | null = null;
  private hoverFrame = 0;
  private pendingHover: PointerEvent | null = null;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly callbacks: ViewerInteractionCallbacks,
  ) {
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerCancel);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
  }

  setTargets(targets: THREE.Object3D[]): void {
    this.targets = targets;
  }

  pickAtCanvasCenter(): ToothPartName | null {
    this.pointer.set(0, 0);
    return this.pickCurrentPointer();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);

    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.hoverFrame = 0;
    this.pendingHover = null;
    this.targets = [];
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerOrigin = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    this.callbacks.onInteraction?.();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pendingHover = event;
    if (this.hoverFrame) return;

    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const pending = this.pendingHover;
      this.pendingHover = null;
      if (!pending || this.disposed) return;

      this.setPointerFromEvent(pending);
      const part = this.pickCurrentPointer();
      this.canvas.style.cursor = part ? "pointer" : "grab";
      this.callbacks.onHover(part);
    });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const origin = this.pointerOrigin;
    this.pointerOrigin = null;
    if (!origin || origin.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (distance > DRAG_THRESHOLD_PX) return;

    this.setPointerFromEvent(event);
    this.callbacks.onSelect(this.pickCurrentPointer());
  };

  private readonly handlePointerCancel = (): void => {
    this.pointerOrigin = null;
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerOrigin = null;
    this.canvas.style.cursor = "grab";
    this.callbacks.onHover(null);
  };

  private setPointerFromEvent(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      this.pointer.set(2, 2);
      return;
    }

    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
  }

  private pickCurrentPointer(): ToothPartName | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.targets, true);

    for (const intersection of intersections) {
      if (!isPickable(intersection)) continue;
      const part = findAnatomyPart(intersection.object);
      if (part) return part;
    }

    return null;
  }
}
