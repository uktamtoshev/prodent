import * as THREE from "three";
import {
  disposeObject3DResources,
  TOOTH_ANATOMY_NODE_NAMES,
  type LoadedToothModel,
  type ModelBannerContract,
  type ToothAnatomyNodeName,
} from "./loadModel";

export const DEMO_PLACEHOLDER_BANNER: ModelBannerContract = Object.freeze({
  kind: "demo-placeholder",
  role: "status",
  persistent: true,
  text: "ДЕМО-PLACEHOLDER — НЕ КЛИНИЧЕСКАЯ МОДЕЛЬ",
  ariaLabel:
    "Показан демонстрационный набор простых фигур. Это не анатомическая и не клиническая модель зуба.",
});

const PLACEHOLDER_COLORS = [
  0x5b8def,
  0xf3a712,
  0xe45756,
  0x45b8ac,
  0x9b6bcc,
  0x7a8599,
] as const;

/**
 * Creates an intentionally non-anatomical test fixture.
 *
 * The separated boxes only exercise selection and layer controls. They must
 * never be presented without DEMO_PLACEHOLDER_BANNER.
 */
export function createDemoPlaceholder(): LoadedToothModel {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1.05, 0.62, 0.36);
  const parts = new Map<ToothAnatomyNodeName, THREE.Object3D>();
  let disposed = false;

  scene.name = "DEMO_PLACEHOLDER_NOT_CLINICAL";
  scene.userData.modelMode = "demo-placeholder";
  scene.userData.isClinicalModel = false;
  scene.userData.banner = DEMO_PLACEHOLDER_BANNER;

  TOOTH_ANATOMY_NODE_NAMES.forEach((name, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: PLACEHOLDER_COLORS[index],
      roughness: 0.72,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const column = index % 3;
    const row = Math.floor(index / 3);

    mesh.name = name;
    mesh.position.set((column - 1) * 1.45, (0.5 - row) * 1.05, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.name = name;
    mesh.userData.sourceNodeName = name;
    mesh.userData.anatomyName = name;
    mesh.userData.anatomyPart = name;
    mesh.userData.isDemoPlaceholder = true;
    material.name = `DemoPlaceholderMaterial_${name}`;

    parts.set(name, mesh);
    scene.add(mesh);
  });

  return {
    mode: "demo-placeholder",
    scene,
    parts,
    missingNodeNames: Object.freeze([]),
    banner: DEMO_PLACEHOLDER_BANNER,
    animations: Object.freeze([]),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObject3DResources(scene);
      parts.clear();
    },
  };
}
