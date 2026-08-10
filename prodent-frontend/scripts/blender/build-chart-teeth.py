"""Crown library for the FDI dental chart. NOT WIRED IN -- see the verdict below.

    blender --background --factory-startup --python-exit-code 1 \
        --python scripts/blender/build-chart-teeth.py -- public/models/teeth-chart.glb

Eight crowns: {upper, lower} x {incisor, canine, premolar, molar}, each
normalised to the unit box so the chart's per-tooth width/height/depth scaling
would apply unchanged.

VERDICT (2026-08-01): these were built to replace the runtime sphere deformation
in src/components/patient/dental/DentalScene3D.tsx, wired in, and compared side
by side in the real chart. The procedural crowns won and the integration was
reverted. What beat this approach:

  - createAnatomicalCrownGeometry already differentiates all four kinds, with
    cusps, fissures, an incisal edge and a canine ridge. The gap was smaller
    than it looked from the chart's default camera.
  - A sphere is convex in every direction, so its crowns read as full and
    rounded. A lofted superellipse profile gives flat faces, which look like
    slabs at chart scale even with a strong depth wedge.
  - The gum scallop is shaped around a crown that converges to a point at the
    cervix. A modelled neck of any real width shows as white wedges between the
    teeth, above the gum line.

Anyone retrying this should start from labial convexity and from matching the
cervical taper of the sphere, not from more occlusal detail -- at ~40 px per
tooth the cusps were never the limiting factor.

NOT CLINICAL. These are recognisable tooth shapes for a status chart, not
anatomically measured crowns. Nothing here should drive a clinical decision.

Contract the chart relies on:
  - node names are exactly "<arch>-<kind>", e.g. "lower-molar"
  - each crown is normalised to fill the unit box, -0.5..0.5 on every axis, so
    the existing per-tooth width/height/depth scaling keeps working unchanged
  - long axis is +Y in glTF, and the biting surface faces -Y for upper crowns
    and +Y for lower ones, matching biteDirection in the chart
  - x is mesio-distal, z is bucco-lingual with +z buccal/labial. The chart reads
    grooves at z~0 and x~0 when it bakes fissure vertex colours, so fissures
    must sit on those lines.

Authoring happens in glTF coordinates and to_blender() maps them, because the
exporter rewrites Blender's +Z up to glTF's +Y up.
"""

import math
import os
import sys

import bpy

SEGMENTS = 40        # around the crown
SIDE_RINGS = 16      # cervix to occlusal rim
CAP_RINGS = 10       # rim to the centre of the biting surface

ARCHES = ("upper", "lower")
KINDS = ("incisor", "canine", "premolar", "molar")

# Outline from cervix (0) to occlusal rim (1), as a fraction of the widest
# point. Width and depth need separate curves: front teeth are wedges, thick at
# the neck and thinning to a blade, while back teeth stay nearly as deep as they
# are wide. One shared curve makes all eight crowns come out as the same blob.
# The neck must pinch in hard. The sphere these replace converged to a point at
# the cervix, so the gum scallop was shaped to meet almost nothing there; a
# crown that stays wide down to its base pokes out between the teeth as white
# wedges above the gum line.
CONTOURS = {
    "incisor": {
        "width": [(0.00, 0.48), (0.10, 0.68), (0.30, 0.88), (0.55, 0.97),
                  (0.78, 1.00), (1.00, 0.96)],
        "depth": [(0.00, 0.50), (0.10, 0.72), (0.28, 0.95), (0.45, 1.00),
                  (0.65, 0.82), (0.82, 0.62), (1.00, 0.46)],
    },
    "canine": {
        "width": [(0.00, 0.46), (0.10, 0.66), (0.32, 0.87), (0.60, 0.98),
                  (0.84, 1.00), (1.00, 0.88)],
        "depth": [(0.00, 0.50), (0.12, 0.74), (0.30, 0.96), (0.48, 1.00),
                  (0.72, 0.82), (1.00, 0.60)],
    },
    "premolar": {
        "width": [(0.00, 0.50), (0.12, 0.70), (0.36, 0.90), (0.64, 1.00),
                  (0.87, 0.97), (1.00, 0.86)],
        "depth": [(0.00, 0.48), (0.12, 0.69), (0.36, 0.90), (0.64, 1.00),
                  (0.87, 0.95), (1.00, 0.84)],
    },
    "molar": {
        "width": [(0.00, 0.54), (0.12, 0.74), (0.36, 0.92), (0.66, 1.00),
                  (0.88, 0.96), (1.00, 0.84)],
        "depth": [(0.00, 0.52), (0.12, 0.72), (0.36, 0.91), (0.66, 1.00),
                  (0.88, 0.95), (1.00, 0.83)],
    },
}

# Superellipse exponent: 2 is an ellipse, higher is squarer. Molars are boxy,
# front teeth are rounded.
SHAPE_EXPONENT = {
    "incisor": 2.15,
    "canine": 2.25,
    "premolar": 2.45,
    "molar": 2.90,
}

# Biting surface as a height field over the rim, in units where the rim is 0.
# Cusps are bumps, fissures are the valleys between them.
OCCLUSAL = {
    "incisor": {
        # A straight mesio-distal edge, rounded across its narrow width, with
        # three faint mamelons along it.
        "base": lambda px, pz: 0.06 - 0.26 * pz ** 2 - 0.05 * px ** 4,
        "cusps": [(-0.48, 0.00, 0.05, 0.22, 0.70),
                  (0.00, 0.00, 0.06, 0.22, 0.70),
                  (0.48, 0.00, 0.05, 0.22, 0.70)],
        "fissures": [],
    },
    "canine": {
        # One cusp with slopes falling away mesially and distally. Kept modest:
        # at chart scale a tall cusp reads as a fang, not a canine.
        "base": lambda px, pz: -0.14 * px ** 2 - 0.18 * (pz - 0.05) ** 2,
        "cusps": [(0.00, 0.05, 0.26, 0.50, 0.60)],
        "fissures": [],
    },
    "premolar": {
        # Buccal and lingual cusp either side of one mesio-distal fissure.
        "base": lambda px, pz: -0.07 * px ** 2,
        "cusps": [(0.00, 0.52, 0.24, 0.78, 0.34),
                  (0.00, -0.52, 0.20, 0.72, 0.34)],
        "fissures": [(0.16, "z", 0.13)],
    },
    "molar": {
        # Four cusps around a cross-shaped fissure pattern.
        "base": lambda px, pz: 0.0,
        "cusps": [(-0.50, 0.50, 0.21, 0.42, 0.42),
                  (0.50, 0.50, 0.20, 0.42, 0.42),
                  (-0.50, -0.50, 0.20, 0.42, 0.42),
                  (0.50, -0.50, 0.19, 0.42, 0.42)],
        "fissures": [(0.14, "z", 0.14), (0.12, "x", 0.13)],
    },
}

# Upper teeth are a little fuller, lower ones narrower and lower-cusped. The
# chart applies real proportions afterwards; this only nudges character.
ARCH_CUSP_GAIN = {"upper": 1.0, "lower": 0.88}

ANTERIOR = ("incisor", "canine")


def make_profile(points):
    """Linear interpolation over control points, smoothed into a curve."""
    samples, passes = 600, 160
    y0, y1 = points[0][0], points[-1][0]
    span = y1 - y0
    values, segment = [], 0
    for i in range(samples):
        t = y0 + span * i / (samples - 1)
        while segment < len(points) - 2 and t > points[segment + 1][0]:
            segment += 1
        (ta, va), (tb, vb) = points[segment], points[segment + 1]
        k = 0.0 if tb == ta else (t - ta) / (tb - ta)
        values.append(va + (vb - va) * min(max(k, 0.0), 1.0))

    for _ in range(passes):
        blurred = values[:]
        for i in range(1, samples - 1):
            blurred[i] = (values[i - 1] + 2.0 * values[i] + values[i + 1]) * 0.25
        values = blurred

    def sample(t):
        k = (t - y0) / span * (samples - 1)
        k = min(max(k, 0.0), samples - 1)
        i = int(k)
        if i >= samples - 1:
            return values[-1]
        return values[i] + (values[i + 1] - values[i]) * (k - i)

    return sample


CONTOUR_PROFILES = {
    kind: {axis: make_profile(points) for axis, points in axes.items()}
    for kind, axes in CONTOURS.items()
}


def outline(theta, exponent):
    """Superellipse point on the unit circle's angle."""
    power = 2.0 / exponent
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    x = math.copysign(abs(cos_t) ** power, cos_t)
    z = math.copysign(abs(sin_t) ** power, sin_t)
    return x, z


def lingual_relief(t, z_sign, kind):
    """Cingulum bulge low on the lingual side, fossa hollow above it.

    Front teeth are not solid wedges: the tongue side carries a bump near the
    neck and a scooped hollow over it. Without this an incisor reads as a chip.
    """
    if kind not in ANTERIOR or z_sign >= 0:
        return 1.0
    cingulum = 0.11 * math.exp(-(((t - 0.17) / 0.14) ** 2))
    fossa = 0.09 * math.exp(-(((t - 0.66) / 0.24) ** 2))
    return 1.0 + cingulum - fossa


def occlusal_height(px, pz, kind, arch):
    """Height above the rim at a point on the biting surface."""
    spec = OCCLUSAL[kind]
    height = spec["base"](px, pz)
    for cusp_x, cusp_z, amplitude, sigma_x, sigma_z in spec["cusps"]:
        height += amplitude * ARCH_CUSP_GAIN[arch] * math.exp(
            -(((px - cusp_x) / sigma_x) ** 2) - (((pz - cusp_z) / sigma_z) ** 2)
        )
    for depth, axis, sigma in spec["fissures"]:
        along = pz if axis == "z" else px
        height -= depth * math.exp(-((along / sigma) ** 2))
    return height


class Mesh:
    def __init__(self):
        self.verts = []
        self.faces = []

    def add_ring(self, radius_fn):
        indices = []
        for j in range(SEGMENTS):
            theta = 2.0 * math.pi * j / SEGMENTS
            indices.append(len(self.verts))
            self.verts.append(radius_fn(theta))
        return indices

    def add_point(self, point):
        self.verts.append(point)
        return len(self.verts) - 1

    def band(self, lower, upper):
        for j in range(SEGMENTS):
            k = (j + 1) % SEGMENTS
            self.faces.append([lower[j], lower[k], upper[k], upper[j]])

    def fan(self, ring, apex, upward):
        for j in range(SEGMENTS):
            k = (j + 1) % SEGMENTS
            self.faces.append([ring[j], ring[k], apex] if upward
                              else [ring[k], ring[j], apex])

    def disc(self, ring, centre, upward):
        self.fan(ring, centre, upward)


def build_crown(arch, kind):
    """One crown, authored biting-surface-up, in glTF axes."""
    exponent = SHAPE_EXPONENT[kind]
    width_at = CONTOUR_PROFILES[kind]["width"]
    depth_at = CONTOUR_PROFILES[kind]["depth"]
    mesh = Mesh()

    def side_point(t, theta):
        unit_x, unit_z = outline(theta, exponent)
        relief = lingual_relief(t, unit_z, kind)
        return (unit_x * width_at(t) * relief, t, unit_z * depth_at(t) * relief)

    side_rings = []
    for i in range(SIDE_RINGS):
        t = i / (SIDE_RINGS - 1)
        side_rings.append(mesh.add_ring(lambda theta, t=t: side_point(t, theta)))

    # Biting surface: concentric rings shrinking from the rim to the centre,
    # each vertex lifted by the height field. Weight fades to zero at the rim so
    # the cap meets the side wall without a seam.
    rim_width, rim_depth = width_at(1.0), depth_at(1.0)
    cap_rings = [side_rings[-1]]
    for i in range(1, CAP_RINGS + 1):
        u = 1.0 - i / CAP_RINGS
        # (1 - u^2)^1.5 flattens to zero slope at the rim, so the biting surface
        # leaves the side wall tangentially instead of breaking over a hard 90
        # degree corner, while still carrying most of its height at the cusps.
        weight = (1.0 - u * u) ** 1.5

        def cap_point(theta, u=u, weight=weight):
            unit_x, unit_z = outline(theta, exponent)
            x = unit_x * rim_width * u
            z = unit_z * rim_depth * u
            # Height field is sampled in rim-relative coordinates so cusps and
            # fissures land in the same place whatever the crown proportions.
            return (x, 1.0 + weight * occlusal_height(unit_x * u, unit_z * u,
                                                      kind, arch), z)

        cap_rings.append(mesh.add_ring(cap_point))

    centre_height = 1.0 + occlusal_height(0.0, 0.0, kind, arch)
    apex = mesh.add_point((0.0, centre_height, 0.0))
    cervix_centre = mesh.add_point((0.0, 0.0, 0.0))

    for i in range(SIDE_RINGS - 1):
        mesh.band(side_rings[i], side_rings[i + 1])
    for i in range(len(cap_rings) - 1):
        mesh.band(cap_rings[i], cap_rings[i + 1])
    mesh.fan(cap_rings[-1], apex, upward=True)
    mesh.disc(side_rings[0], cervix_centre, upward=False)

    normalise(mesh.verts)

    if arch == "upper":
        # Biting surface must face -Y. Mirroring flips every face, so the
        # winding has to be reversed or the crown renders inside out.
        mesh.verts = [(x, -y, z) for x, y, z in mesh.verts]
        mesh.faces = [list(reversed(face)) for face in mesh.faces]

    return mesh


def normalise(verts):
    """Fit exactly into -0.5..0.5 on each axis, which is what the chart scales."""
    lo = [min(v[a] for v in verts) for a in range(3)]
    hi = [max(v[a] for v in verts) for a in range(3)]
    for i, vertex in enumerate(verts):
        scaled = []
        for a in range(3):
            span = hi[a] - lo[a]
            scaled.append((vertex[a] - lo[a]) / span - 0.5 if span > 1e-9 else 0.0)
        verts[i] = tuple(scaled)


def to_blender(point):
    """glTF (x, y, z) -> Blender (x, y, z). The exporter undoes this."""
    x, y, z = point
    return (x, -z, y)


def create_object(name, mesh):
    data = bpy.data.meshes.new(name)
    data.from_pydata([to_blender(v) for v in mesh.verts], [], mesh.faces)
    data.update()

    if len(data.polygons) != len(mesh.faces):
        raise RuntimeError(
            f"{name}: Blender kept {len(data.polygons)} of {len(mesh.faces)} faces"
        )

    for polygon in data.polygons:
        polygon.use_smooth = True
    data.validate(verbose=False)

    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.calc_loop_triangles()
    return obj, len(data.loop_triangles)


def main():
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender --background --python this.py -- <out.glb>")
    out_path = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    total = 0
    for arch in ARCHES:
        for kind in KINDS:
            name = f"{arch}-{kind}"
            obj, tris = create_object(name, build_crown(arch, kind))
            total += tris
            print(f"CROWN {name}: verts={len(obj.data.vertices)} tris={tris}")

    wanted = {
        "filepath": out_path,
        "export_format": "GLB",
        "use_selection": False,
        "export_apply": True,
        "export_yup": True,
        "export_normals": True,
        "export_texcoords": False,
        "export_materials": "NONE",
        "export_cameras": False,
        "export_lights": False,
        "export_extras": False,
        "export_animations": False,
        "export_skins": False,
        "export_morph": False,
        "export_draco_mesh_compression_enable": False,
    }
    supported = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in supported})

    print(f"TOTAL_TRIS: {total}  (per tooth on screen: ~{total // 8})")
    print(f"WROTE: {out_path} ({os.path.getsize(out_path)} bytes)")
    print("BUILD_OK")


main()
