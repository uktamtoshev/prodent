"""Generates the DEMO-PLACEHOLDER tooth GLB.

    blender --background --factory-startup --python-exit-code 1 \
        --python scripts/blender/build-tooth-demo.py -- public/models/tooth.demo.glb

THIS IS NOT A CLINICAL MODEL. The shape is a plausible single-rooted tooth built
from parametric profiles, not a scan or a dentist-verified asset. It exists so
the viewer's layer, selection and clipping controls can be exercised against a
real six-node GLB. Anything shown to a patient must come from an asset that a
dentist signed off on, per public/models/README.md.

Layer thicknesses are anatomically ordered but not anatomically exact. Cementum
in particular is drawn thicker than the real 20-200 um so the layer stays
visible when toggled.

Output contract (public/models/README.md):
  - glTF 2.0 binary, one scene, everything embedded, no cameras or lights
  - six sibling nodes: Enamel, Dentin, Pulp, RootCanal, Cementum,
    PeriodontalLigament -- none nested inside another
  - metric scale, transforms applied, long axis along +Y *in glTF*

Blender is +Z up and the glTF exporter rotates to +Y up, so the model is built
along +Z here. scripts/blender/validate-tooth-glb.py checks the exported axis
rather than trusting that conversion.
"""

import math
import os
import sys

import bpy

# --- output contract ---------------------------------------------------------

PART_NAMES = (
    "Enamel",
    "Dentin",
    "Pulp",
    "RootCanal",
    "Cementum",
    "PeriodontalLigament",
)

# Colours mirror src/data/toothAnatomy.ts. They only separate layers visually;
# the viewer identifies parts by node name, never by colour.
PART_STYLE = {
    "Enamel": ("#F3F0DF", 0.22),
    "Dentin": ("#D8B36A", 0.58),
    "Pulp": ("#D96A6A", 0.74),
    "RootCanal": ("#A94352", 0.70),
    "Cementum": ("#C9A982", 0.66),
    "PeriodontalLigament": ("#E4A09C", 0.82),
}

# --- geometry constants ------------------------------------------------------

MM = 0.001               # profiles are authored in millimetres, exported in metres
SEGMENTS = 48            # angular resolution; drives the triangle budget
MIN_RADIUS_MM = 0.02     # keeps interior rings off the axis so no band degenerates
CEJ_MM = 12.0            # cementoenamel junction: root below, crown above
APEX_MM = 0.0
TIP_MM = 22.05

# Mean outer radius of the whole tooth, apex (0) to incisal tip.
OUTER_PROFILE = [
    (0.00, 0.00), (0.30, 0.42), (0.90, 0.80), (1.80, 1.15), (3.00, 1.55),
    (5.00, 2.05), (7.00, 2.45), (9.00, 2.75), (10.50, 2.95), (12.00, 3.05),
    (12.80, 3.35), (14.00, 3.65), (15.50, 3.80), (17.00, 3.78), (18.50, 3.55),
    (19.80, 3.10), (20.80, 2.40), (21.50, 1.60), (21.85, 0.85), (22.05, 0.00),
]

# Enamel thickness over the crown. It reaches the full radius near the incisal
# edge, which is what closes the dentin core off below the tip.
ENAMEL_THICKNESS = [
    (12.00, 0.06), (13.00, 0.35), (14.50, 0.70), (16.50, 1.05), (18.50, 1.35),
    (19.80, 1.90), (20.60, 2.35), (21.50, 1.60), (22.05, 0.00),
]

# Cementum over the root. Exaggerated for visibility (see module docstring).
CEMENTUM_THICKNESS = [
    (0.00, 0.34), (3.00, 0.28), (7.00, 0.20), (10.00, 0.15), (12.00, 0.12),
]

PDL_THICKNESS_MM = 0.20  # realistic periodontal ligament width

# Neighbouring layers must not share a surface. Coincident faces z-fight, which
# shows up as banding the moment the viewer makes a layer transparent. 15 um is
# invisible on a 22 mm tooth and enough to separate the depth values.
LAYER_CLEARANCE_MM = 0.015

# Pulp chamber and root canal are separate nodes covering one continuous space.
# They meet flat at the canal orifice instead of interpenetrating: overlapping
# solids double-cover a volume, which reads as a hole once anything sections or
# clips the model.
CANAL_ORIFICE_MM = 10.00
ORIFICE_RADIUS_MM = 0.90

PULP_PROFILE = [
    (CANAL_ORIFICE_MM, ORIFICE_RADIUS_MM), (10.80, 0.98), (12.50, 1.05),
    (14.50, 1.15), (16.00, 1.05), (17.30, 0.70), (18.60, 0.00),
]

ROOT_CANAL_PROFILE = [
    (0.55, 0.00), (1.20, 0.16), (3.00, 0.30), (5.50, 0.45), (7.50, 0.62),
    (9.00, 0.78), (CANAL_ORIFICE_MM, ORIFICE_RADIUS_MM),
]

# Cross-section is an ellipse: wide mesio-distally, flat labio-lingually, and
# flattest at the incisal edge.
FLATTENING_PROFILE = [
    (0.00, 0.80), (8.00, 0.80), (13.00, 0.66), (18.00, 0.60), (21.00, 0.48),
    (22.05, 0.45),
]

# Three faint mamelon lobes, crown only.
LOBE_PROFILE = [
    (0.00, 0.00), (17.00, 0.00), (19.50, 1.00), (21.20, 0.60), (22.05, 0.20),
]
LOBE_DEPTH = 0.030

ROOT_BEND_MM = 0.45  # gentle root curve, so the tooth does not read as a lathe


def make_profile(points, samples=1200, smoothing_passes=300):
    """Piecewise-linear control points, blurred into a smooth radius function.

    Endpoints are pinned, so a profile that starts or ends at zero still closes
    on the axis after smoothing.
    """
    y0, y1 = points[0][0], points[-1][0]
    span = y1 - y0
    values = []
    segment = 0
    for i in range(samples):
        y = y0 + span * i / (samples - 1)
        while segment < len(points) - 2 and y > points[segment + 1][0]:
            segment += 1
        (ya, ra), (yb, rb) = points[segment], points[segment + 1]
        t = 0.0 if yb == ya else (y - ya) / (yb - ya)
        values.append(ra + (rb - ra) * min(max(t, 0.0), 1.0))

    for _ in range(smoothing_passes):
        blurred = values[:]
        for i in range(1, samples - 1):
            blurred[i] = (values[i - 1] + 2.0 * values[i] + values[i + 1]) * 0.25
        values = blurred

    def sample(y):
        t = (y - y0) / span * (samples - 1)
        t = min(max(t, 0.0), samples - 1)
        i = int(t)
        if i >= samples - 1:
            return values[-1]
        return values[i] + (values[i + 1] - values[i]) * (t - i)

    return sample


outer_radius = make_profile(OUTER_PROFILE)
enamel_thickness = make_profile(ENAMEL_THICKNESS)
cementum_thickness = make_profile(CEMENTUM_THICKNESS)
pulp_radius = make_profile(PULP_PROFILE)
canal_radius = make_profile(ROOT_CANAL_PROFILE)
flattening = make_profile(FLATTENING_PROFILE, smoothing_passes=120)
lobe_weight = make_profile(LOBE_PROFILE, smoothing_passes=120)


def dentin_radius(y):
    """Outer tooth minus whichever hard tissue covers it at that height."""
    cover = enamel_thickness(y) if y >= CEJ_MM else cementum_thickness(y)
    return max(outer_radius(y) - cover, 0.0)


def clear_of_dentin(y, outer_value):
    """Inner wall of a covering layer, held just off the dentin below it.

    Clamped against the layer's own outer wall so the shell never inverts where
    it feathers out to nothing, at the apex and at the incisal tip.
    """
    return min(dentin_radius(y) + LAYER_CLEARANCE_MM, outer_value * 0.995)


def root_bend(y):
    if y >= CEJ_MM:
        return 0.0
    return ROOT_BEND_MM * ((CEJ_MM - y) / CEJ_MM) ** 2


def surface_point(y_mm, theta, radius_mm):
    """Blender-space point. Long axis is +Z here; the exporter maps it to +Y."""
    radius = radius_mm * (1.0 + LOBE_DEPTH * lobe_weight(y_mm) * math.cos(3.0 * theta))
    x = radius * math.cos(theta) + root_bend(y_mm)
    y = radius * math.sin(theta) * flattening(y_mm)
    return (x * MM, y * MM, y_mm * MM)


# --- mesh assembly -----------------------------------------------------------


class SurfaceBuilder:
    """Rings of vertices stitched into bands, with collapsed rings as poles."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.face_uvs = []

    def add_ring(self, y_mm, radius_mm, collapse_allowed):
        if radius_mm < 1e-6 and collapse_allowed:
            index = len(self.verts)
            self.verts.append(surface_point(y_mm, 0.0, 0.0))
            return [index]

        radius = max(radius_mm, MIN_RADIUS_MM)
        indices = []
        for j in range(SEGMENTS):
            theta = 2.0 * math.pi * j / SEGMENTS
            indices.append(len(self.verts))
            self.verts.append(surface_point(y_mm, theta, radius))
        return indices

    @staticmethod
    def _corner(ring, j):
        return ring[0] if len(ring) == 1 else ring[j % SEGMENTS]

    @staticmethod
    def _u(ring, j):
        return (j + 0.5) / SEGMENTS if len(ring) == 1 else j / SEGMENTS

    def _emit(self, corners):
        """Drops repeated vertices so pole bands become triangles, not slivers."""
        loop = []
        for vertex, uv in corners:
            if loop and loop[-1][0] == vertex:
                continue
            loop.append((vertex, uv))
        if len(loop) > 2 and loop[0][0] == loop[-1][0]:
            loop.pop()
        if len(loop) < 3:
            return
        self.faces.append([vertex for vertex, _ in loop])
        self.face_uvs.append([uv for _, uv in loop])

    def add_band(self, lower, upper, v_lower, v_upper, flip=False):
        """`lower`/`upper` are rings; winding faces outward unless flipped."""
        for j in range(SEGMENTS):
            a0 = (self._corner(lower, j), (self._u(lower, j), v_lower))
            a1 = (self._corner(lower, j + 1), (self._u(lower, j + 1), v_lower))
            b0 = (self._corner(upper, j), (self._u(upper, j), v_upper))
            b1 = (self._corner(upper, j + 1), (self._u(upper, j + 1), v_upper))
            self._emit([a0, b0, b1, a1] if flip else [a0, a1, b1, b0])

    def add_disc(self, ring, y_mm, v, facing_up):
        """Flat cap on an end that does not converge to the axis."""
        if len(ring) < 3:
            return
        center = len(self.verts)
        self.verts.append(surface_point(y_mm, 0.0, 0.0))
        for j in range(SEGMENTS):
            a = (ring[j], (self._u(ring, j), v))
            b = (ring[(j + 1) % SEGMENTS], (self._u(ring, j + 1), v))
            c = (center, (0.5, v))
            self._emit([a, b, c] if facing_up else [b, a, c])

    def add_rim(self, outer_ring, inner_ring, v, at_top):
        """Closes an open end of a shell with an annulus."""
        if len(outer_ring) == 1 and len(inner_ring) == 1:
            return
        for j in range(SEGMENTS):
            o0 = (self._corner(outer_ring, j), (self._u(outer_ring, j), v))
            o1 = (self._corner(outer_ring, j + 1), (self._u(outer_ring, j + 1), v))
            i0 = (self._corner(inner_ring, j), (self._u(inner_ring, j), v))
            i1 = (self._corner(inner_ring, j + 1), (self._u(inner_ring, j + 1), v))
            self._emit([o0, o1, i1, i0] if at_top else [o0, i0, i1, o1])


def ring_heights(y_from, y_to, count):
    return [y_from + (y_to - y_from) * i / (count - 1) for i in range(count)]


def build_solid(y_from, y_to, rings, radius_fn):
    """A closed body: poles where the profile reaches the axis, flat caps where
    it does not. Leaving an end open would produce a mesh that renders fine but
    breaks every boolean and clipping operation downstream.
    """
    builder = SurfaceBuilder()
    heights = ring_heights(y_from, y_to, rings)
    span = y_to - y_from
    made = []
    for i, y in enumerate(heights):
        at_end = i == 0 or i == rings - 1
        made.append((y, builder.add_ring(y, radius_fn(y), at_end)))
    for i in range(rings - 1):
        (ya, lower), (yb, upper) = made[i], made[i + 1]
        builder.add_band(lower, upper, (ya - y_from) / span, (yb - y_from) / span)

    builder.add_disc(made[0][1], y_from, 0.0, facing_up=False)
    builder.add_disc(made[-1][1], y_to, 1.0, facing_up=True)
    return builder


def build_shell(y_from, y_to, rings, outer_fn, inner_fn, cap_bottom, cap_top):
    """Two concentric surfaces on a shared grid, joined at the open ends."""
    builder = SurfaceBuilder()
    heights = ring_heights(y_from, y_to, rings)
    span = y_to - y_from
    outer_rings, inner_rings = [], []
    for i, y in enumerate(heights):
        at_end = i == 0 or i == rings - 1
        outer_rings.append(builder.add_ring(y, outer_fn(y), at_end))
        inner_rings.append(builder.add_ring(y, inner_fn(y), at_end))

    for i in range(rings - 1):
        v_lo = (heights[i] - y_from) / span
        v_hi = (heights[i + 1] - y_from) / span
        builder.add_band(outer_rings[i], outer_rings[i + 1], v_lo, v_hi)
        builder.add_band(inner_rings[i], inner_rings[i + 1], v_lo, v_hi, flip=True)

    if cap_bottom:
        builder.add_rim(outer_rings[0], inner_rings[0], 0.0, at_top=False)
    if cap_top:
        builder.add_rim(outer_rings[-1], inner_rings[-1], 1.0, at_top=True)
    return builder


# --- Blender objects ---------------------------------------------------------


def srgb_to_linear(channel):
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_material(name, hex_color, roughness):
    material = bpy.data.materials.new(name=f"{name}_MAT")
    if material.node_tree is None:
        material.use_nodes = True

    # Every part is a closed volume, so back faces are never legitimately seen.
    # This exports as doubleSided:false, halving fragment work and stopping
    # interior faces from showing through once the viewer fades a layer.
    material.use_backface_culling = True

    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"No Principled BSDF in material {material.name}")

    rgb = hex_color.lstrip("#")
    linear = [srgb_to_linear(int(rgb[i:i + 2], 16)) for i in (0, 2, 4)]
    bsdf.inputs["Base Color"].default_value = (*linear, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return material


def create_object(name, builder):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(builder.verts, [], builder.faces)
    mesh.update()

    if len(mesh.polygons) != len(builder.faces):
        raise RuntimeError(
            f"{name}: Blender kept {len(mesh.polygons)} of {len(builder.faces)} faces"
        )

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon, uvs in zip(mesh.polygons, builder.face_uvs):
        polygon.use_smooth = True
        for corner, loop_index in enumerate(polygon.loop_indices):
            uv_layer.data[loop_index].uv = uvs[corner]

    if not mesh.validate(verbose=False):
        pass  # validate() returns True when it had to change the mesh

    hex_color, roughness = PART_STYLE[name]
    mesh.materials.append(make_material(name, hex_color, roughness))

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def main():
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender --background --python this.py -- <out.glb>")
    out_path = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Dentin stops below the incisal edge, where enamel thickness eats the whole
    # radius; the solid is closed just above that point.
    dentin_top = 21.50

    parts = {
        "Dentin": build_solid(
            APEX_MM, dentin_top, 130,
            lambda y: 0.0 if y <= APEX_MM + 1e-9 or y >= dentin_top - 1e-9
            else dentin_radius(y),
        ),
        "Enamel": build_shell(
            CEJ_MM, TIP_MM, 58,
            outer_radius,
            lambda y: clear_of_dentin(y, outer_radius(y)) if y < dentin_top else 0.0,
            cap_bottom=True, cap_top=False,
        ),
        "Cementum": build_shell(
            APEX_MM, CEJ_MM, 68,
            outer_radius,
            lambda y: clear_of_dentin(y, outer_radius(y)),
            cap_bottom=False, cap_top=True,
        ),
        "PeriodontalLigament": build_shell(
            0.15, 11.70, 66,
            lambda y: outer_radius(y) + LAYER_CLEARANCE_MM + PDL_THICKNESS_MM,
            lambda y: outer_radius(y) + LAYER_CLEARANCE_MM,
            cap_bottom=True, cap_top=True,
        ),
        # Ranges come from the profiles themselves; hardcoding them lets the two
        # drift apart and leaves the body open at one end.
        "Pulp": build_solid(
            PULP_PROFILE[0][0], PULP_PROFILE[-1][0], 34, pulp_radius
        ),
        "RootCanal": build_solid(
            ROOT_CANAL_PROFILE[0][0], ROOT_CANAL_PROFILE[-1][0], 42, canal_radius
        ),
    }

    total_tris = 0
    for name in PART_NAMES:
        obj = create_object(name, parts[name])
        tris = triangle_count(obj)
        total_tris += tris
        print(f"PART {name}: verts={len(obj.data.vertices)} tris={tris}")

    scene_names = sorted(o.name for o in bpy.context.scene.objects)
    if scene_names != sorted(PART_NAMES):
        raise RuntimeError(f"Unexpected scene contents: {scene_names}")
    for obj in bpy.context.scene.objects:
        if obj.parent is not None:
            raise RuntimeError(f"{obj.name} must be a root node, not nested")

    wanted = {
        "filepath": out_path,
        "export_format": "GLB",
        "use_selection": False,
        "export_apply": True,
        "export_yup": True,
        "export_normals": True,
        "export_texcoords": True,
        "export_materials": "EXPORT",
        "export_cameras": False,
        "export_lights": False,
        "export_extras": False,
        "export_animations": False,
        "export_skins": False,
        "export_morph": False,
        "export_draco_mesh_compression_enable": False,
    }
    supported = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs = {k: v for k, v in wanted.items() if k in supported}
    dropped = sorted(set(wanted) - set(kwargs))
    if dropped:
        print("EXPORTER_IGNORED_OPTIONS:", dropped)

    bpy.ops.export_scene.gltf(**kwargs)

    print(f"TOTAL_TRIS: {total_tris}")
    print(f"WROTE: {out_path} ({os.path.getsize(out_path)} bytes)")
    print("BUILD_OK")


main()
