import { useEffect, useMemo, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Html, OrbitControls, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  createFdiLayout,
  DentalArch,
  DentitionType,
  FdiToothLayout,
  ToothKind,
  ToothStatus,
} from "./fdiDentalModel";

export type DentalView = "both" | "upper" | "lower";

export interface DentalScene3DProps {
  dentition: DentitionType;
  statuses: Record<number, ToothStatus>;
  selectedTooth: number | null;
  view: DentalView;
  resetKey: number;
  onSelectTooth: (toothNumber: number) => void;
  onWebGlLost?: () => void;
}

interface ToothDimensions {
  width: number;
  height: number;
  depth: number;
  cuspCount: number;
}

const PERMANENT_TOOTH_DIMENSIONS: Record<DentalArch, Record<number, ToothDimensions>> = {
  upper: {
    1: { width: 0.88, height: 1.32, depth: 0.60, cuspCount: 0 },
    2: { width: 0.72, height: 1.20, depth: 0.56, cuspCount: 0 },
    3: { width: 0.82, height: 1.40, depth: 0.74, cuspCount: 1 },
    4: { width: 0.92, height: 1.12, depth: 1.02, cuspCount: 2 },
    5: { width: 0.90, height: 1.08, depth: 1.00, cuspCount: 2 },
    6: { width: 1.18, height: 1.02, depth: 1.27, cuspCount: 4 },
    7: { width: 1.10, height: 0.98, depth: 1.19, cuspCount: 4 },
    8: { width: 1.00, height: 0.93, depth: 1.09, cuspCount: 4 },
  },
  lower: {
    1: { width: 0.58, height: 1.06, depth: 0.50, cuspCount: 0 },
    2: { width: 0.64, height: 1.10, depth: 0.52, cuspCount: 0 },
    3: { width: 0.72, height: 1.25, depth: 0.65, cuspCount: 1 },
    4: { width: 0.78, height: 1.00, depth: 0.88, cuspCount: 2 },
    5: { width: 0.86, height: 1.00, depth: 0.96, cuspCount: 2 },
    6: { width: 1.16, height: 0.98, depth: 1.15, cuspCount: 5 },
    7: { width: 1.08, height: 0.94, depth: 1.08, cuspCount: 4 },
    8: { width: 0.98, height: 0.90, depth: 1.02, cuspCount: 4 },
  },
};

const PRIMARY_TOOTH_DIMENSIONS: Record<DentalArch, Record<number, ToothDimensions>> = {
  upper: {
    1: { width: 0.78, height: 1.08, depth: 0.58, cuspCount: 0 },
    2: { width: 0.68, height: 1.02, depth: 0.56, cuspCount: 0 },
    3: { width: 0.76, height: 1.18, depth: 0.68, cuspCount: 1 },
    4: { width: 1.02, height: 0.92, depth: 1.08, cuspCount: 4 },
    5: { width: 1.06, height: 0.90, depth: 1.12, cuspCount: 4 },
  },
  lower: {
    1: { width: 0.62, height: 0.96, depth: 0.52, cuspCount: 0 },
    2: { width: 0.66, height: 1.00, depth: 0.54, cuspCount: 0 },
    3: { width: 0.70, height: 1.10, depth: 0.62, cuspCount: 1 },
    4: { width: 0.96, height: 0.88, depth: 1.00, cuspCount: 4 },
    5: { width: 1.02, height: 0.88, depth: 1.06, cuspCount: 4 },
  },
};

const UNIT_CROWN_GEOMETRY = new THREE.SphereGeometry(0.5, 30, 22);
const UNIT_ROOT_GEOMETRY = new THREE.ConeGeometry(0.5, 1, 14);
const UNIT_IMPLANT_GEOMETRY = new THREE.CylinderGeometry(0.31, 0.22, 1.22, 14);
const UNIT_IMPLANT_THREAD_GEOMETRY = new THREE.TorusGeometry(0.28, 0.035, 5, 12);
const MARKER_GEOMETRY = new THREE.SphereGeometry(0.5, 12, 8);
const HALO_GEOMETRY = new THREE.TorusGeometry(0.5, 0.045, 8, 28);
const SOCKET_GEOMETRY = new THREE.TorusGeometry(0.34, 0.11, 10, 24);
const HIT_TARGET_GEOMETRY = new THREE.SphereGeometry(0.5, 8, 6);
const MOUTH_CAVITY_GEOMETRY = new THREE.SphereGeometry(0.5, 32, 18);

const ROOT_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: "#dfd3bc",
  roughness: 0.48,
  clearcoat: 0.14,
});
const IMPLANT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#a4adb4",
  roughness: 0.34,
  metalness: 0.76,
});
const IMPLANT_COLLAR_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#89949c",
  roughness: 0.3,
  metalness: 0.72,
});
const SELECTED_HALO_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#3ee6c7",
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});
const INVISIBLE_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});
const SOCKET_MATERIALS = {
  idle: new THREE.MeshPhysicalMaterial({ color: "#783e46", roughness: 0.65, clearcoat: 0.2 }),
  selected: new THREE.MeshPhysicalMaterial({ color: "#45dcc1", roughness: 0.56, clearcoat: 0.28 }),
};
const GUM_MATERIALS: Record<DentalArch, THREE.MeshPhysicalMaterial> = {
  upper: new THREE.MeshPhysicalMaterial({
    color: "#ce7480",
    roughness: 0.46,
    clearcoat: 0.25,
    clearcoatRoughness: 0.32,
    sheen: 0.4,
    sheenColor: "#ffb0b3",
    vertexColors: true,
    side: THREE.DoubleSide,
  }),
  lower: new THREE.MeshPhysicalMaterial({
    color: "#c96c78",
    roughness: 0.48,
    clearcoat: 0.23,
    clearcoatRoughness: 0.34,
    sheen: 0.38,
    sheenColor: "#fda7ad",
    vertexColors: true,
    side: THREE.DoubleSide,
  }),
};

const MOUTH_CAVITY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#16080c",
  roughness: 0.94,
  metalness: 0,
});

const STATUS_MARKER_MATERIALS: Partial<Record<ToothStatus, THREE.Material>> = {
  caries: new THREE.MeshStandardMaterial({ color: "#4a1d12", roughness: 0.72 }),
  filling: new THREE.MeshStandardMaterial({ color: "#aab7c4", roughness: 0.24, metalness: 0.65 }),
  watch: new THREE.MeshBasicMaterial({ color: "#f59e0b", transparent: true, opacity: 0.92, depthWrite: false }),
  endo: new THREE.MeshStandardMaterial({
    color: "#d94b54",
    roughness: 0.56,
    emissive: "#d94b54",
    emissiveIntensity: 0.25,
  }),
  periodontitis: new THREE.MeshBasicMaterial({
    color: "#dc3744",
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  }),
};

const crownGeometryCache = new Map<string, THREE.BufferGeometry>();
const rootGeometryCache = new Map<string, THREE.BufferGeometry>();
const enamelMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

function getDimensions(arch: DentalArch, kind: ToothKind, toothNumber: number): ToothDimensions {
  const digit = toothNumber % 10;
  const table = toothNumber >= 50 ? PRIMARY_TOOTH_DIMENSIONS : PERMANENT_TOOTH_DIMENSIONS;
  return table[arch][digit] || PERMANENT_TOOTH_DIMENSIONS[arch][kind === "molar" ? 6 : kind === "premolar" ? 4 : kind === "canine" ? 3 : 2];
}

function cloneWithTransform(
  source: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
): THREE.BufferGeometry {
  const geometry = source.clone();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function mergeParts(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) {
    throw new Error(`Failed to create ${name} geometry`);
  }
  merged.name = name;
  return merged;
}

function addCrownVertexColors(
  geometry: THREE.BufferGeometry,
  arch: DentalArch,
  kind: ToothKind,
  dimensions: ToothDimensions,
) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const biteDirection = arch === "upper" ? -1 : 1;
  const posterior = kind === "premolar" || kind === "molar";

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const biteHeight = biteDirection * y;
    const nearBitingSurface = biteHeight > dimensions.height * 0.31;
    const centralGroove =
      posterior &&
      nearBitingSurface &&
      Math.abs(z) < dimensions.depth * 0.065 &&
      Math.abs(x) < dimensions.width * 0.42;
    const crossGroove =
      kind === "molar" &&
      nearBitingSurface &&
      Math.abs(x) < dimensions.width * 0.055 &&
      Math.abs(z) < dimensions.depth * 0.38;
    const pit =
      posterior &&
      nearBitingSurface &&
      Math.hypot(x / dimensions.width, z / dimensions.depth) < 0.075;
    const cervicalWarmth = THREE.MathUtils.clamp(
      (-biteDirection * y) / (dimensions.height * 0.5),
      0,
      1,
    );

    let red = 1;
    let green = 0.985 - cervicalWarmth * 0.045;
    let blue = 0.93 - cervicalWarmth * 0.085;
    if (centralGroove || crossGroove || pit) {
      red = 0.49;
      green = 0.34;
      blue = 0.2;
    }

    colors[index * 3] = red;
    colors[index * 3 + 1] = green;
    colors[index * 3 + 2] = blue;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function signedPower(value: number, power: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

function getToothSide(toothNumber: number): -1 | 1 {
  const quadrant = Math.floor(toothNumber / 10);
  return [1, 4, 5, 8].includes(quadrant) ? -1 : 1;
}

function createAnatomicalCrownGeometry(
  arch: DentalArch,
  kind: ToothKind,
  toothNumber: number,
): THREE.BufferGeometry {
  const dimensions = getDimensions(arch, kind, toothNumber);
  const biteDirection = arch === "upper" ? -1 : 1;
  const posterior = kind === "premolar" || kind === "molar";
  const side = getToothSide(toothNumber);
  const crown = UNIT_CROWN_GEOMETRY.clone();
  const position = crown.getAttribute("position");
  const cuspCenters: Array<readonly [number, number, number]> = kind === "premolar"
    ? [[0, -0.21, 0.92], [0, 0.21, 1.08]]
    : dimensions.cuspCount === 5
      ? [
          [-0.22, -0.20, 0.94],
          [0.22, -0.20, 0.92],
          [-0.22, 0.20, 1.05],
          [0.20, 0.21, 1.02],
          [0.32 * side, 0.02, 0.82],
        ]
      : [
          [-0.22, -0.21, 0.94],
          [0.22, -0.21, 0.91],
          [-0.22, 0.21, 1.07],
          [0.22, 0.21, 1.02],
        ];

  for (let index = 0; index < position.count; index += 1) {
    let x = position.getX(index);
    let y = position.getY(index);
    let z = position.getZ(index);

    if (kind === "incisor") {
      x = 0.5 * signedPower(x * 2, 0.72);
      y = 0.5 * signedPower(y * 2, 0.80);
      z = 0.5 * signedPower(z * 2, 1.18);
    } else if (kind === "canine") {
      x = 0.5 * signedPower(x * 2, 0.88);
      z = 0.5 * signedPower(z * 2, 1.04);
    } else {
      x = 0.5 * signedPower(x * 2, 0.78);
      y = 0.5 * signedPower(y * 2, 0.88);
      z = 0.5 * signedPower(z * 2, 0.78);
    }

    let biteHeight = biteDirection * y;
    const crownProgress = THREE.MathUtils.clamp(biteHeight + 0.5, 0, 1);
    const cervicalNarrowing = 0.77 + 0.23 * THREE.MathUtils.smoothstep(crownProgress, 0.05, 0.9);

    x *= cervicalNarrowing;
    z *= cervicalNarrowing;

    if (kind === "incisor") {
      const blend = THREE.MathUtils.smoothstep(biteHeight, 0.16, 0.46);
      const edge = 0.405 - 0.018 * Math.pow(x / 0.5, 2) + (z > 0 ? 0.01 : 0);
      y = THREE.MathUtils.lerp(y, biteDirection * edge, blend);
      x *= 1 + blend * 0.055;
      z *= 1 - blend * 0.075;
    } else if (kind === "canine") {
      const blend = THREE.MathUtils.smoothstep(biteHeight, 0.13, 0.46);
      const ridge = Math.exp(-Math.pow(x / 0.23, 2) - Math.pow((z - 0.04) / 0.28, 2));
      const tip = 0.36 + ridge * 0.115;
      y = THREE.MathUtils.lerp(y, biteDirection * tip, blend);
      if (z > 0) z += 0.018 * (1 - Math.abs(x) * 2);
    } else if (posterior) {
      const blend = THREE.MathUtils.smoothstep(biteHeight, 0.13, 0.43);
      let cuspField = 0;
      for (const [cuspX, cuspZ, weight] of cuspCenters) {
        const influence = weight * Math.exp(
          -Math.pow((x - cuspX) / 0.16, 2) - Math.pow((z - cuspZ) / 0.16, 2),
        );
        cuspField = Math.max(cuspField, influence);
      }
      const longGroove = Math.exp(-Math.pow(z / 0.065, 2));
      const crossGroove = kind === "molar" ? Math.exp(-Math.pow(x / 0.06, 2)) : 0;
      const fissure = Math.max(longGroove * 0.8, crossGroove * 0.58);
      const occlusalHeight = 0.335 + cuspField * 0.092 - fissure * 0.03;
      y = THREE.MathUtils.lerp(y, biteDirection * occlusalHeight, blend);
    }

    biteHeight = biteDirection * y;
    const frontConvexity = Math.max(0, z) * Math.max(0, 1 - Math.abs(biteHeight) * 1.7);
    z += frontConvexity * (kind === "incisor" ? 0.045 : 0.022);
    position.setXYZ(index, x, y, z);
  }

  crown.scale(dimensions.width, dimensions.height, dimensions.depth);
  crown.computeVertexNormals();
  crown.computeBoundingSphere();
  crown.name = `fdi-${arch}-${toothNumber}-crown`;
  addCrownVertexColors(crown, arch, kind, dimensions);
  return crown;
}

function getCrownGeometry(arch: DentalArch, kind: ToothKind, toothNumber: number): THREE.BufferGeometry {
  const key = `${arch}-${kind}-${toothNumber >= 50 ? "primary" : "permanent"}-${toothNumber % 10}-${getToothSide(toothNumber)}`;
  const cached = crownGeometryCache.get(key);
  if (cached) return cached;
  const geometry = createAnatomicalCrownGeometry(arch, kind, toothNumber);
  crownGeometryCache.set(key, geometry);
  return geometry;
}

function createRootGeometry(
  arch: DentalArch,
  kind: ToothKind,
  toothNumber: number,
  implant: boolean,
): THREE.BufferGeometry {
  const gumDirection = arch === "upper" ? 1 : -1;

  if (implant) {
    const baseRotation: [number, number, number] = [0, 0, gumDirection < 0 ? Math.PI : 0];
    const parts = [
      cloneWithTransform(
        UNIT_IMPLANT_GEOMETRY,
        [0, gumDirection * 0.82, 0],
        baseRotation,
        [1, 1, 1],
      ),
    ];
    for (let index = 0; index < 5; index += 1) {
      parts.push(
        cloneWithTransform(
          UNIT_IMPLANT_THREAD_GEOMETRY,
          [0, gumDirection * (0.4 + index * 0.2), 0],
          [Math.PI / 2, 0, 0],
          [1 - index * 0.035, 1 - index * 0.035, 1],
        ),
      );
    }
    return mergeParts(parts, `fdi-${arch}-implant-root`);
  }

  const digit = toothNumber % 10;
  const rootCount = kind === "molar"
    ? arch === "upper" ? 3 : 2
    : kind === "premolar" && arch === "upper" && digit === 4
      ? 2
      : 1;
  const offsets = rootCount === 3 ? [-0.25, 0, 0.25] : rootCount === 2 ? [-0.16, 0.16] : [0];
  const parts = offsets.map((offset, index) =>
    cloneWithTransform(
      UNIT_ROOT_GEOMETRY,
      [offset, gumDirection * 0.82, index % 2 === 0 ? -0.04 : 0.09],
      [0, 0, (gumDirection < 0 ? Math.PI : 0) + offset * 0.48 * gumDirection],
      [0.26, 1.05, 0.24],
    ),
  );
  return mergeParts(parts, `fdi-${arch}-${kind}-roots`);
}

function getRootGeometry(
  arch: DentalArch,
  kind: ToothKind,
  toothNumber: number,
  implant: boolean,
): THREE.BufferGeometry {
  const key = implant ? `${arch}-implant` : `${arch}-${kind}-${toothNumber % 10}`;
  const cached = rootGeometryCache.get(key);
  if (cached) return cached;
  const geometry = createRootGeometry(arch, kind, toothNumber, implant);
  geometry.computeBoundingSphere();
  rootGeometryCache.set(key, geometry);
  return geometry;
}

function getEnamelMaterial(status: ToothStatus, selected: boolean): THREE.MeshPhysicalMaterial {
  const key = `${status}-${selected ? "selected" : "idle"}`;
  const cached = enamelMaterialCache.get(key);
  if (cached) return cached;

  const color = status === "unexamined"
    ? "#d8dedc"
    : status === "crown"
      ? "#f1e4c0"
      : status === "implant"
        ? "#f4eee0"
        : "#f6f0dd";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: status === "crown" ? 0.18 : 0.24,
    metalness: 0,
    clearcoat: 0.58,
    clearcoatRoughness: 0.18,
    ior: 1.52,
    specularIntensity: 0.82,
    specularColor: "#fff8ea",
    sheen: 0.12,
    sheenColor: "#fff7e8",
    emissive: selected ? "#1ea991" : "#000000",
    emissiveIntensity: selected ? 0.14 : 0,
    vertexColors: true,
  });
  material.name = `fdi-enamel-${key}`;
  enamelMaterialCache.set(key, material);
  return material;
}

function ToothRoots({
  arch,
  kind,
  toothNumber,
  status,
}: {
  arch: DentalArch;
  kind: ToothKind;
  toothNumber: number;
  status: ToothStatus;
}) {
  const implant = status === "implant";
  return (
    <mesh
      geometry={getRootGeometry(arch, kind, toothNumber, implant)}
      material={implant ? IMPLANT_MATERIAL : ROOT_MATERIAL}
      castShadow
      receiveShadow
    />
  );
}

function ToothStatusMarker({
  arch,
  kind,
  status,
  dimensions,
}: {
  arch: DentalArch;
  kind: ToothKind;
  status: ToothStatus;
  dimensions: ToothDimensions;
}) {
  const biteDirection = arch === "upper" ? -1 : 1;
  const material = STATUS_MARKER_MATERIALS[status];

  if (!material || status === "healthy" || status === "crown" || status === "implant" || status === "removed") {
    return null;
  }

  if (status === "watch" || status === "periodontitis") {
    const atGumLine = status === "periodontitis";
    return (
      <mesh
        geometry={HALO_GEOMETRY}
        material={material}
        position={[0, atGumLine ? -biteDirection * dimensions.height * 0.36 : 0, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[dimensions.width * 0.78, dimensions.depth * 0.78, 1]}
      />
    );
  }

  const markerScale: [number, number, number] =
    kind === "molar" ? [0.34, 0.1, 0.28] : [0.25, 0.09, 0.2];
  return (
    <mesh
      geometry={MARKER_GEOMETRY}
      material={material}
      position={[0.08, biteDirection * dimensions.height * 0.43, 0.06]}
      scale={markerScale}
    />
  );
}

function MissingToothSocket({ arch, selected }: { arch: DentalArch; selected: boolean }) {
  const biteDirection = arch === "upper" ? -1 : 1;

  return (
    <group>
      <mesh
        geometry={SOCKET_GEOMETRY}
        material={selected ? SOCKET_MATERIALS.selected : SOCKET_MATERIALS.idle}
        position={[0, biteDirection * 0.12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh geometry={HIT_TARGET_GEOMETRY} material={INVISIBLE_MATERIAL} scale={[0.8, 0.72, 0.8]} />
    </group>
  );
}

function ToothModel({
  tooth,
  status,
  selected,
  onSelect,
}: {
  tooth: FdiToothLayout;
  status: ToothStatus;
  selected: boolean;
  onSelect: (number: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dimensions = getDimensions(tooth.arch, tooth.kind, tooth.number);
  const biteDirection = tooth.arch === "upper" ? -1 : 1;
  const visualScale = tooth.scale * (selected ? 1.08 : hovered ? 1.035 : 1);
  useCursor(hovered);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(tooth.number);
  };

  return (
    <group
      position={tooth.position}
      rotation={[0, tooth.rotationY, 0]}
      scale={visualScale}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {status === "removed" ? (
        <MissingToothSocket arch={tooth.arch} selected={selected} />
      ) : (
        <>
          <ToothRoots
            arch={tooth.arch}
            kind={tooth.kind}
            toothNumber={tooth.number}
            status={status}
          />
          <mesh
            geometry={getCrownGeometry(tooth.arch, tooth.kind, tooth.number)}
            material={getEnamelMaterial(status, selected)}
            castShadow
            receiveShadow
          />
          <ToothStatusMarker
            arch={tooth.arch}
            kind={tooth.kind}
            status={status}
            dimensions={dimensions}
          />
          {status === "implant" && (
            <mesh
              geometry={HALO_GEOMETRY}
              material={IMPLANT_COLLAR_MATERIAL}
              position={[0, -biteDirection * dimensions.height * 0.35, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[dimensions.width * 0.65, dimensions.depth * 0.65, 1]}
            />
          )}
        </>
      )}

      {selected && (
        <mesh
          geometry={HALO_GEOMETRY}
          material={SELECTED_HALO_MATERIAL}
          position={[0, biteDirection * 0.04, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[dimensions.width * 0.95, dimensions.depth * 0.95, 1]}
        />
      )}

      {(hovered || selected) && (
        <Html
          position={[0, 0, dimensions.depth * 0.64]}
          center
          distanceFactor={14}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            className={`block min-w-6 rounded-md border px-1.5 py-0.5 text-center text-[10px] font-bold shadow-sm backdrop-blur-sm ${
              selected
                ? "border-emerald-300 bg-emerald-500 text-white"
                : "border-white/35 bg-slate-950/70 text-white"
            }`}
          >
            {tooth.number}
          </span>
        </Html>
      )}
    </group>
  );
}

function addGumVertexColors(geometry: THREE.BufferGeometry, arch: DentalArch) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const mottling = 0.96 + 0.025 * Math.sin(x * 1.8 + z * 2.3) * Math.cos(y * 1.4);
    const palateSoftening = arch === "upper" && Math.abs(x) < 2.2 && z < 0.4 ? 0.025 : 0;
    colors[index * 3] = 1;
    colors[index * 3 + 1] = mottling + palateSoftening;
    colors[index * 3 + 2] = mottling * 0.98 + palateSoftening;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

interface GumLineSample {
  x: number;
  z: number;
  marginY: number;
  scale: number;
  /** 1 directly over a root, 0 midway between two of them. */
  overRoot: number;
}

function createGumLineSamples(teeth: FdiToothLayout[], arch: DentalArch): GumLineSample[] {
  const gumDirection = arch === "upper" ? 1 : -1;
  const biteDirection = -gumDirection;
  const samples: GumLineSample[] = [];
  const subdivisions = 10;

  for (let toothIndex = 0; toothIndex < teeth.length - 1; toothIndex += 1) {
    const current = teeth[toothIndex];
    const next = teeth[toothIndex + 1];
    const currentDimensions = getDimensions(current.arch, current.kind, current.number);
    const nextDimensions = getDimensions(next.arch, next.kind, next.number);
    const currentMargin = current.position[1]
      + gumDirection * currentDimensions.height * 0.34 * current.scale;
    const nextMargin = next.position[1]
      + gumDirection * nextDimensions.height * 0.34 * next.scale;

    for (let step = 0; step < subdivisions; step += 1) {
      const t = step / subdivisions;
      const papilla = Math.pow(Math.sin(Math.PI * t), 1.7) * 0.19;
      samples.push({
        x: THREE.MathUtils.lerp(current.position[0], next.position[0], t),
        z: THREE.MathUtils.lerp(current.position[2], next.position[2], t),
        marginY: THREE.MathUtils.lerp(currentMargin, nextMargin, t) + biteDirection * papilla,
        scale: THREE.MathUtils.lerp(current.scale, next.scale, t),
        overRoot: Math.cos(2 * Math.PI * t) * 0.5 + 0.5,
      });
    }
  }

  const last = teeth[teeth.length - 1];
  if (last) {
    const dimensions = getDimensions(last.arch, last.kind, last.number);
    samples.push({
      x: last.position[0],
      z: last.position[2],
      marginY: last.position[1] + gumDirection * dimensions.height * 0.34 * last.scale,
      scale: last.scale,
      overRoot: 1,
    });
  }

  return samples;
}

function createGumRibbonGeometry(teeth: FdiToothLayout[], arch: DentalArch): THREE.BufferGeometry {
  const gumDirection = arch === "upper" ? 1 : -1;
  const samples = createGumLineSamples(teeth, arch);
  const maxX = Math.max(1, ...samples.map((sample) => Math.abs(sample.x)));
  const rows = 8;
  const layerSize = rows * samples.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let layer = 0; layer < 2; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      const v = row / (rows - 1);
      for (let column = 0; column < samples.length; column += 1) {
        const sample = samples[column];
        const flare = 1 + v * 0.035;
        const centreLift = 0.16 * (1 - Math.pow(Math.abs(sample.x) / maxX, 1.55));
        const baseY = gumDirection * (2.28 + centreLift) * sample.scale;
        const yBlend = THREE.MathUtils.smoothstep(v, 0.12, 0.9);
        const y = THREE.MathUtils.lerp(sample.marginY, baseY, yBlend);
        // Root eminences: real gingiva rides over each root as a soft vertical
        // ridge and hollows between them. A perfectly even band reads as a
        // denture base.
        // Strongest near the gum margin, fading out toward the vestibule, which
        // is where the ridges actually sit. Keep the amplitude low: evenly
        // spaced ridges at full strength read as corduroy, not tissue.
        const eminence = sample.overRoot * 0.075 * Math.sin(Math.PI * Math.pow(v, 0.75));
        const frontBulge = 0.18 + Math.sin(Math.PI * v) * 0.48 + v * 0.08 + eminence;
        // The band used to stop at full thickness, leaving a slab with a cut
        // edge. Drawing both faces back together turns that into a ridge.
        const edgeTaper = 1 - 0.42 * THREE.MathUtils.smoothstep(v, 0.72, 1);
        const z = layer === 0
          ? sample.z + frontBulge * edgeTaper * sample.scale
          : sample.z - (0.56 + v * 0.24) * edgeTaper * sample.scale;
        positions.push(sample.x * flare, y, z);
        uvs.push(column / Math.max(1, samples.length - 1), v);
      }
    }
  }

  const vertex = (layer: number, row: number, column: number) =>
    layer * layerSize + row * samples.length + column;

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < samples.length - 1; column += 1) {
      const frontA = vertex(0, row, column);
      const frontB = vertex(0, row, column + 1);
      const frontC = vertex(0, row + 1, column);
      const frontD = vertex(0, row + 1, column + 1);
      indices.push(frontA, frontC, frontB, frontB, frontC, frontD);

      const backA = vertex(1, row, column);
      const backB = vertex(1, row, column + 1);
      const backC = vertex(1, row + 1, column);
      const backD = vertex(1, row + 1, column + 1);
      indices.push(backA, backB, backC, backB, backD, backC);
    }
  }

  for (let column = 0; column < samples.length - 1; column += 1) {
    for (const row of [0, rows - 1]) {
      const frontA = vertex(0, row, column);
      const frontB = vertex(0, row, column + 1);
      const backA = vertex(1, row, column);
      const backB = vertex(1, row, column + 1);
      indices.push(frontA, frontB, backA, frontB, backB, backA);
    }
  }

  for (const column of [0, samples.length - 1]) {
    for (let row = 0; row < rows - 1; row += 1) {
      const frontA = vertex(0, row, column);
      const frontB = vertex(0, row + 1, column);
      const backA = vertex(1, row, column);
      const backB = vertex(1, row + 1, column);
      indices.push(frontA, backA, frontB, frontB, backA, backB);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = `fdi-${arch}-gingiva-ribbon`;
  return geometry;
}

function createGumArchGeometry(teeth: FdiToothLayout[], arch: DentalArch): THREE.BufferGeometry {
  const geometry = createGumRibbonGeometry(teeth, arch);
  geometry.name = `fdi-${arch}-gingiva`;
  geometry.computeBoundingSphere();
  addGumVertexColors(geometry, arch);
  return geometry;
}

function GumArch({ layout, arch }: { layout: FdiToothLayout[]; arch: DentalArch }) {
  const teeth = useMemo(() => layout.filter((tooth) => tooth.arch === arch), [layout, arch]);
  const gumGeometry = useMemo(() => createGumArchGeometry(teeth, arch), [arch, teeth]);

  useEffect(() => () => gumGeometry.dispose(), [gumGeometry]);

  return (
    <mesh
      geometry={gumGeometry}
      material={GUM_MATERIALS[arch]}
      castShadow
      receiveShadow
    />
  );
}

function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    const previousEnvironment = scene.environment;
    scene.environment = environment;
    invalidate();

    return () => {
      if (scene.environment === environment) scene.environment = previousEnvironment;
      environment.dispose();
      generator.dispose();
      room.dispose();
    };
  }, [gl, invalidate, scene]);

  return null;
}

function CameraRig({ view, resetKey }: { view: DentalView; resetKey: number }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const position: [number, number, number] =
      view === "upper" ? [0, 5.3, 16.4] : view === "lower" ? [0, -5.3, 16.4] : [0, 0.05, 18.4];
    const targetY = view === "upper" ? 1.25 : view === "lower" ? -1.25 : 0;
    camera.position.set(...position);
    camera.lookAt(0, targetY, -0.15);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, resetKey, view]);

  return null;
}

function WebGlLifecycle({ onLost }: { onLost?: () => void }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let recoveryTimer: number | null = null;
    const handleLost = (event: Event) => {
      event.preventDefault();
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => onLost?.(), 3500);
    };
    const handleRestored = () => {
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      recoveryTimer = null;
      gl.resetState();
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl, invalidate, onLost]);

  return null;
}

function DentalArchModel({
  arch,
  layout,
  statuses,
  selectedTooth,
  onSelectTooth,
}: {
  arch: DentalArch;
  layout: FdiToothLayout[];
  statuses: Record<number, ToothStatus>;
  selectedTooth: number | null;
  onSelectTooth: (toothNumber: number) => void;
}) {
  return (
    <>
      <GumArch layout={layout} arch={arch} />
      {layout
        .filter((tooth) => tooth.arch === arch)
        .map((tooth) => (
          <ToothModel
            key={tooth.number}
            tooth={tooth}
            status={statuses[tooth.number] || "unexamined"}
            selected={selectedTooth === tooth.number}
            onSelect={onSelectTooth}
          />
        ))}
    </>
  );
}

function DentalMouth({
  dentition,
  statuses,
  selectedTooth,
  view,
  onSelectTooth,
}: Omit<DentalScene3DProps, "resetKey" | "onWebGlLost">) {
  const layout = useMemo(() => createFdiLayout(dentition), [dentition]);
  const showUpper = view !== "lower";
  const showLower = view !== "upper";
  const cavityY = view === "upper" ? 1.2 : view === "lower" ? -1.2 : 0;
  const cavityHeight = view === "both" ? 2.75 : 1.75;
  const lowerJawOpening = THREE.MathUtils.degToRad(4);
  const lowerJawHingeZ = -3.2;

  return (
    <group rotation={[-0.025, 0, 0]} dispose={null}>
      <mesh
        geometry={MOUTH_CAVITY_GEOMETRY}
        material={MOUTH_CAVITY_MATERIAL}
        position={[0, cavityY, -2.75]}
        scale={[5.75, cavityHeight, 0.52]}
        receiveShadow
      />
      {showUpper && (
        <DentalArchModel
          arch="upper"
          layout={layout}
          statuses={statuses}
          selectedTooth={selectedTooth}
          onSelectTooth={onSelectTooth}
        />
      )}
      {showLower && (
        <group position={[0, 0, lowerJawHingeZ]} rotation={[lowerJawOpening, 0, 0]}>
          <group position={[0, 0, -lowerJawHingeZ]}>
            <DentalArchModel
              arch="lower"
              layout={layout}
              statuses={statuses}
              selectedTooth={selectedTooth}
              onSelectTooth={onSelectTooth}
            />
          </group>
        </group>
      )}
    </group>
  );
}

function createDentalRenderer(canvas: HTMLCanvasElement | OffscreenCanvas): THREE.WebGLRenderer {
  const contextAttributes: WebGLContextAttributes = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  };
  const context = canvas.getContext("webgl2", contextAttributes);

  if (!context) throw new Error("GPU rendering is not available");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: context as WebGLRenderingContext,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.useLegacyLights = false;
  return renderer;
}

export default function DentalScene3D(props: DentalScene3DProps) {
  const targetY = props.view === "upper" ? 1.25 : props.view === "lower" ? -1.25 : 0;
  const [rendererLabel, setRendererLabel] = useState("GPU");

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0.05, 18.4], fov: 31, near: 0.1, far: 70 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={createDentalRenderer}
        shadows="soft"
        performance={{ min: 0.55, debounce: 250 }}
        fallback={<div className="h-full w-full bg-slate-950" />}
        onCreated={({ gl }) => {
          setRendererLabel(gl.capabilities.isWebGL2 ? "GPU · WebGL2" : "GPU · WebGL");
        }}
      >
        <color attach="background" args={["#050708"]} />
        <fog attach="fog" args={["#050708", 21, 36]} />
        <CameraRig view={props.view} resetKey={props.resetKey} />
        <WebGlLifecycle onLost={props.onWebGlLost} />
        <StudioEnvironment />

        <ambientLight intensity={0.25} />
        <hemisphereLight args={["#f6fffd", "#471923", 0.46]} />
        <directionalLight
          castShadow
          position={[5, 8, 10]}
          intensity={2.05}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.00045}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight position={[-6, 2, 9]} intensity={0.66} color="#dbeeff" />
        <pointLight position={[0, -1, 10]} intensity={0.5} color="#ffd8cb" />
        <pointLight position={[0, 7, -3]} intensity={0.55} color="#ffffff" />
        <pointLight position={[-7, 4, -1]} intensity={0.85} color="#2fe4c4" />
        <pointLight position={[7, -3, -1]} intensity={0.68} color="#36cdb8" />

        <DentalMouth
          dentition={props.dentition}
          statuses={props.statuses}
          selectedTooth={props.selectedTooth}
          view={props.view}
          onSelectTooth={props.onSelectTooth}
        />

        <OrbitControls
          makeDefault
          target={[0, targetY, -0.15]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.68}
          zoomSpeed={0.82}
          minDistance={9}
          maxDistance={26}
          minPolarAngle={0.35}
          maxPolarAngle={2.78}
          regress
        />
        <AdaptiveDpr pixelated />
      </Canvas>

      <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/60 backdrop-blur-sm">
        {rendererLabel}
      </div>
    </div>
  );
}
