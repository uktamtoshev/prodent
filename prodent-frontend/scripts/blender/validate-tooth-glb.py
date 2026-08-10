"""Checks a tooth GLB against the contract in public/models/README.md.

    blender --background --factory-startup --python-exit-code 1 \
        --python scripts/blender/validate-tooth-glb.py -- public/models/tooth.demo.glb

Stdlib only, so any Python 3 also runs it:

    python scripts/blender/validate-tooth-glb.py public/models/tooth.demo.glb

It parses the GLB itself instead of trusting the exporter, which is the point:
Blender authors +Z up and the exporter is expected to rewrite the model to +Y
up, so the axis is verified against the bytes that ship.

This validates the file format and the performance budget. It cannot validate
anatomy -- a demo placeholder passes every check here and is still not a
clinical asset.
"""

import json
import struct
import sys

REQUIRED_NODES = [
    "Enamel",
    "Dentin",
    "Pulp",
    "RootCanal",
    "Cementum",
    "PeriodontalLigament",
]

MAX_TRIS_DESKTOP = 200_000
MAX_TRIS_MOBILE = 100_000
MAX_DRAW_CALLS = 25
MAX_TEXTURE_SIZE = 2048

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

COMPONENT_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}


class Report:
    def __init__(self):
        self.failures = []
        self.warnings = []

    def check(self, ok, message):
        print(("  OK   " if ok else "  FAIL ") + message)
        if not ok:
            self.failures.append(message)

    def warn(self, message):
        print("  WARN " + message)
        self.warnings.append(message)


def read_glb(path):
    with open(path, "rb") as handle:
        blob = handle.read()

    if len(blob) < 12:
        raise SystemExit(f"{path}: too small to be a GLB")
    magic, version, declared = struct.unpack_from("<III", blob, 0)
    if magic != GLB_MAGIC:
        raise SystemExit(f"{path}: not a GLB (bad magic)")
    if version != 2:
        raise SystemExit(f"{path}: glTF version {version}, expected 2")
    if declared != len(blob):
        raise SystemExit(f"{path}: header says {declared} bytes, file has {len(blob)}")

    gltf, binary, offset = None, None, 12
    while offset + 8 <= len(blob):
        length, kind = struct.unpack_from("<II", blob, offset)
        payload = blob[offset + 8:offset + 8 + length]
        if kind == CHUNK_JSON:
            gltf = json.loads(payload.decode("utf-8"))
        elif kind == CHUNK_BIN:
            binary = payload
        offset += 8 + length + (-length % 4)

    if gltf is None:
        raise SystemExit(f"{path}: no JSON chunk")
    return blob, gltf, binary


def trs_matrix(node):
    """Node transform as a 4x4 row-major matrix."""
    if "matrix" in node:  # glTF stores matrices column-major
        m = node["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]

    tx, ty, tz = node.get("translation", (0.0, 0.0, 0.0))
    x, y, z, w = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
    sx, sy, sz = node.get("scale", (1.0, 1.0, 1.0))
    rot = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    scale = (sx, sy, sz)
    return [
        [rot[r][0] * scale[0], rot[r][1] * scale[1], rot[r][2] * scale[2], t]
        for r, t in zip(range(3), (tx, ty, tz))
    ] + [[0.0, 0.0, 0.0, 1.0]]


def apply(matrix, point):
    return tuple(
        sum(matrix[r][c] * point[c] for c in range(3)) + matrix[r][3] for r in range(3)
    )


def indices_count(gltf, primitive):
    if "indices" in primitive:
        return gltf["accessors"][primitive["indices"]]["count"]
    return gltf["accessors"][primitive["attributes"]["POSITION"]]["count"]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
    if not args:
        raise SystemExit("Usage: validate-tooth-glb.py <model.glb>")
    path = args[0]

    blob, gltf, binary = read_glb(path)
    report = Report()

    meshes = gltf.get("meshes", [])
    nodes = gltf.get("nodes", [])
    scenes = gltf.get("scenes", [])

    print(f"\n{path}  ({len(blob)} bytes)")
    print(f"generator: {gltf.get('asset', {}).get('generator', '?')}\n")

    print("Structure")
    report.check(len(scenes) == 1, f"exactly one scene (found {len(scenes)})")
    scene = scenes[gltf.get("scene", 0)] if scenes else {"nodes": []}
    root_indices = scene.get("nodes", [])
    root_names = [nodes[i].get("name", "") for i in root_indices]

    for name in REQUIRED_NODES:
        report.check(name in root_names, f"root node present: {name}")

    extra = [n for n in root_names if n not in REQUIRED_NODES]
    report.check(not extra, f"no unexpected root nodes (found {extra or 'none'})")

    nested = [
        nodes[child].get("name", f"#{child}")
        for node in nodes
        for child in node.get("children", [])
        if nodes[child].get("name") in REQUIRED_NODES
    ]
    report.check(not nested, f"no anatomy node nested in another (found {nested or 'none'})")

    print("\nEmbedding")
    external = [b for b in gltf.get("buffers", []) if "uri" in b]
    report.check(not external, f"no external buffers (found {len(external)})")
    report.check(binary is not None, "binary chunk is embedded in the GLB")
    remote = [i for i in gltf.get("images", []) if "uri" in i]
    report.check(not remote, f"no external image URIs (found {len(remote)})")
    report.check(not gltf.get("cameras"), f"no cameras (found {len(gltf.get('cameras', []))})")
    lights = gltf.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", [])
    report.check(not lights, f"no punctual lights (found {len(lights)})")

    print("\nGeometry")
    draw_calls = 0
    triangles = 0
    missing_normals, missing_uvs, bad_mode = [], [], []
    for mesh in meshes:
        for primitive in mesh.get("primitives", []):
            draw_calls += 1
            mode = primitive.get("mode", 4)
            if mode != 4:
                bad_mode.append((mesh.get("name", "?"), mode))
            triangles += indices_count(gltf, primitive) // 3
            attributes = primitive.get("attributes", {})
            if "NORMAL" not in attributes:
                missing_normals.append(mesh.get("name", "?"))
            if "TEXCOORD_0" not in attributes:
                missing_uvs.append(mesh.get("name", "?"))

    report.check(not bad_mode, f"all primitives are triangles (bad: {bad_mode or 'none'})")
    report.check(not missing_normals, f"every primitive has normals (missing: {missing_normals or 'none'})")
    report.check(not missing_uvs, f"every primitive has UVs (missing: {missing_uvs or 'none'})")
    report.check(
        draw_calls <= MAX_DRAW_CALLS,
        f"draw calls {draw_calls} <= {MAX_DRAW_CALLS}",
    )
    report.check(
        triangles <= MAX_TRIS_DESKTOP,
        f"triangles {triangles:,} <= {MAX_TRIS_DESKTOP:,} (desktop budget)",
    )
    if triangles > MAX_TRIS_MOBILE:
        report.warn(f"triangles {triangles:,} exceed the {MAX_TRIS_MOBILE:,} mobile target")
    else:
        report.check(True, f"triangles {triangles:,} <= {MAX_TRIS_MOBILE:,} (mobile target)")

    print("\nTextures")
    images = gltf.get("images", [])
    if not images:
        report.check(True, "no textures, so nothing to transcode (0 MB GPU)")
    else:
        for sampler in gltf.get("samplers", []):
            pass
        report.warn(f"{len(images)} image(s) present; check size <= {MAX_TEXTURE_SIZE}px manually")

    print("\nOrientation and scale")
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    per_part = {}
    for index in root_indices:
        node = nodes[index]
        if "mesh" not in node:
            continue
        matrix = trs_matrix(node)
        part_lo, part_hi = [float("inf")] * 3, [float("-inf")] * 3
        for primitive in meshes[node["mesh"]].get("primitives", []):
            accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
            if "min" not in accessor or "max" not in accessor:
                report.warn(f"{node.get('name')}: POSITION accessor has no min/max")
                continue
            amin, amax = accessor["min"], accessor["max"]
            for bits in range(8):
                corner = [amax[a] if bits >> a & 1 else amin[a] for a in range(3)]
                moved = apply(matrix, corner)
                for a in range(3):
                    part_lo[a] = min(part_lo[a], moved[a])
                    part_hi[a] = max(part_hi[a], moved[a])
        per_part[node.get("name")] = (part_lo, part_hi)
        for a in range(3):
            lo[a] = min(lo[a], part_lo[a])
            hi[a] = max(hi[a], part_hi[a])

    size = [hi[a] - lo[a] for a in range(3)]
    axis = max(range(3), key=lambda a: size[a])
    print(f"  bounding box (m): X={size[0]:.4f}  Y={size[1]:.4f}  Z={size[2]:.4f}")
    report.check(axis == 1, f"long axis is +Y (longest is {'XYZ'[axis]})")
    report.check(
        0.005 <= size[1] <= 0.060,
        f"length {size[1] * 1000:.1f} mm reads as a real tooth in metres",
    )

    print("\n  part extents along the long axis (mm from apex):")
    origin = lo[1]
    for name in REQUIRED_NODES:
        if name not in per_part:
            continue
        part_lo, part_hi = per_part[name]
        print(
            f"    {name:<21} {(part_lo[1] - origin) * 1000:6.2f} .. "
            f"{(part_hi[1] - origin) * 1000:6.2f}"
        )

    print("\nMaterials")
    report.check(
        len(gltf.get("materials", [])) == len(REQUIRED_NODES),
        f"one material per part ({len(gltf.get('materials', []))})",
    )

    print()
    if report.failures:
        print(f"FAILED: {len(report.failures)} check(s)")
        for failure in report.failures:
            print(f"  - {failure}")
        raise SystemExit(1)

    print(f"VALIDATION_OK ({len(report.warnings)} warning(s))")
    print("Reminder: this file is a DEMO PLACEHOLDER, not a clinical model.")


main()
