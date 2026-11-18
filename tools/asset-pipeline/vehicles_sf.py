"""
Build public/assets/props/vehicles.glb from the CC-BY Sketchfab models listed in docs/ASSETS.md.

    blender -b --factory-startup --python tools/asset-pipeline/vehicles_sf.py -- <download dir> <out.glb>

<download dir> holds one folder per kind with the Sketchfab "glb" download inside (raw_<kind>/model.glb),
fetched by hand from the uids below (raw downloads stay out of git).

Every vehicle becomes ONE mesh node (name = vehicle kind), origin at the centre of its footprint on the
ground, length along the glTF Z axis with the front towards +Z, in metres. A node keeps one primitive per
material (the game draws one InstancedMesh per primitive). Processing:
- interiors, badges and number plates are dropped; window glass becomes one shared opaque dark material and
  light covers (transparent glass over the lamps) are dropped, so nothing needs alpha blending;
- the car body material is renamed `<kind>_paint` with a light grey base so the game can tint it per instance;
- spec/gloss materials (the crane) are converted to metal/rough, and its untextured materials are merged
  into one palette texture (fewer draw calls);
- identical textures and materials shared by several models (same author kit) are merged, so they ship once;
- meshes over the triangle budget are decimated, textures are resized (512 px, 1024 for the crane) and
  written as JPEG.
"""
import hashlib
import math
import re
import sys

import bpy
import mathutils
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]

# kind: (sketchfab uid, yaw in degrees to put the front at Blender -Y (= glTF +Z), scale, max tris, max texture px)
KINDS = {
    'sedan': ('7fd6e15785fa4aa9bfd6e31eb7c97ba6', -90, 1.0, 20000, 512),
    'hatchback': ('122a22d210234596ad23623588d0d166', -90, 1.0, 20000, 512),
    'suv': ('2866efdfa943484391ef8313768e074d', -90, 1.0, 20000, 512),
    'van': ('09d718c9cf72401b8534d265a06a803f', -90, 1.0, 20000, 512),
    'pickup': ('6c48c94be8974dc7a5932f697c0ba68f', -90, 1.0, 20000, 512),
    'truck': ('3be03b6a43aa41898c9ca806b8787052', -90, 1.0, 20000, 512),
    # the download is not to scale: 12.8 m long tractor + trailer
    'semi': ('ee0a8763bd8941f1bc546b43332d4001', 0, 12.8 / 1.9, 20000, 512),
    # authored in centimetres and slightly oversized: 3.6 m long with the forks, 2.3 m tall
    'forklift': ('060f3f8bc7de4e6ca2f348d414702e9d', 180, 0.0085, 20000, 512),
    'crane_truck': ('317c5dbcad974d9f99efd079060d4344', 180, 1.0, 30000, 1024),
}

DROP_MATERIAL = re.compile(r'Interiors|Carbadges|Numberplates', re.I)
GLASS_MATERIAL = re.compile(r'Transperent|Transparent|Glass_blinn', re.I)
PAINT_MATERIAL = re.compile(r'bodymat', re.I)


def base_name(name):
    return re.sub(r'\.\d{3}$', '', name)


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def make_glass():
    m = bpy.data.materials.get('vehicle_glass')
    if m:
        return m
    m = bpy.data.materials.new('vehicle_glass')
    m.use_nodes = True
    b = principled(m)
    b.inputs['Base Color'].default_value = (0.025, 0.03, 0.035, 1)
    b.inputs['Roughness'].default_value = 0.12
    b.inputs['Metallic'].default_value = 0.5
    return m


def convert_specgloss(mat):
    """KHR spec/gloss import (diffuse + glossy nodes) -> principled metal/rough; returns (colour, image or None)."""
    nt = mat.node_tree
    diff = next((n for n in nt.nodes if n.type == 'BSDF_DIFFUSE'), None)
    gloss = next((n for n in nt.nodes if n.type == 'BSDF_GLOSSY'), None)
    col = tuple(diff.inputs['Color'].default_value) if diff else (0.5, 0.5, 0.5, 1)
    img = next((n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    rough = gloss.inputs['Roughness'].default_value if gloss else 0.6
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = max(0.45, min(0.9, rough))
    b.inputs['Metallic'].default_value = 0.1
    if img:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    mat.blend_method = 'OPAQUE'
    return col, img


def palette_merge(o, kind):
    """Untextured materials -> one material sampling a palette image (one block of colour per material)."""
    slots = [s.material for s in o.material_slots]
    flat = [i for i, m in enumerate(slots) if m and principled(m) and not principled(m).inputs['Base Color'].is_linked]
    if len(flat) < 2:
        return
    cells = math.ceil(math.sqrt(len(flat)))
    px = 8  # pixels per cell; UVs point at the cell centre
    size = cells * px
    img = bpy.data.images.new(f'{kind}_palette', size, size, alpha=False)
    pix = np.zeros((size, size, 4), dtype=np.float32)
    uv_of = {}
    for k, si in enumerate(flat):
        cx, cy = k % cells, k // cells
        c = principled(slots[si]).inputs['Base Color'].default_value
        srgb = [x * 12.92 if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055 for x in c[:3]]  # byte image = sRGB
        pix[cy * px:(cy + 1) * px, cx * px:(cx + 1) * px] = (*srgb, 1)
        uv_of[si] = ((cx + 0.5) / cells, (cy + 0.5) / cells)
    img.pixels.foreach_set(pix.ravel())
    img.pack()
    pal = bpy.data.materials.new(f'{kind}_palette')
    pal.use_nodes = True
    b = principled(pal)
    b.inputs['Roughness'].default_value = 0.65
    b.inputs['Metallic'].default_value = 0.15
    t = pal.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    t.interpolation = 'Closest'
    pal.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    o.data.materials.append(pal)
    pal_index = len(o.data.materials) - 1
    for p in me.polygons:
        if p.material_index in uv_of:
            u, v = uv_of[p.material_index]
            for li in p.loop_indices:
                uv[li].uv = (u, v)
            p.material_index = pal_index


def simplify(mat, paint):
    """Plain metal/rough: base colour (+ metal/rough map), no clearcoat, specular map, occlusion or UV transforms."""
    nt = mat.node_tree
    b = principled(mat)
    if b is None:
        return
    for name in ('Specular IOR Level', 'Specular Tint', 'Coat Weight', 'Coat Roughness', 'Normal') if paint else (
            'Specular IOR Level', 'Specular Tint', 'Coat Weight', 'Coat Roughness'):
        i = b.inputs.get(name)
        if i is None:
            continue
        for link in list(i.links):
            nt.links.remove(link)
    b.inputs['Coat Weight'].default_value = 0.0
    b.inputs['Specular IOR Level'].default_value = 0.5
    if paint:
        for name in ('Metallic', 'Roughness'):
            for link in list(b.inputs[name].links):
                nt.links.remove(link)
        b.inputs['Metallic'].default_value = 0.35
        b.inputs['Roughness'].default_value = 0.42
    for n in list(nt.nodes):
        if n.type == 'GROUP':  # glTF Material Output (occlusion)
            nt.nodes.remove(n)
    dead = True
    while dead:  # textures and mapping nodes nothing reads any more
        dead = [n for n in nt.nodes if n.type in ('TEX_IMAGE', 'MAPPING', 'TEX_COORD', 'UVMAP', 'SEPARATE_COLOR', 'SEPRGB', 'MATH', 'MIX')
                and not any(out.links for out in n.outputs)]
        for n in dead:
            nt.nodes.remove(n)


def keep_render_uv(o):
    me = o.data
    keep = next((u.name for u in me.uv_layers if u.active_render), me.uv_layers[0].name if me.uv_layers else None)
    for u in list(me.uv_layers):
        if u.name != keep:
            me.uv_layers.remove(u)


def drop_unused_slots(o):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.material_slot_remove_unused()


def build(kind, uid, yaw, scale, max_tris, max_px):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f'{SRC}/raw_{kind}/model.glb')
    objs = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in objs if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    # bake world transforms, then drop the import hierarchy
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in objs:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    keep = []
    for o in meshes:
        if o.data.users > 1:
            o.data = o.data.copy()
        names = [s.material.name if s.material else '' for s in o.material_slots]
        if names and all(DROP_MATERIAL.search(n) for n in names):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        part = o.name.lower()
        for n in names:
            part = part.replace(base_name(n).lower(), '')
        if names and all(GLASS_MATERIAL.search(n) for n in names) and 'light' in part:
            bpy.data.objects.remove(o, do_unlink=True)  # lamp cover over an opaque lamp
            continue
        keep.append(o)
    for o in keep:
        o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(keep) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = kind
    o.data.name = kind
    # remove faces of dropped materials inside multi-material parts
    me = o.data
    bad = {i for i, s in enumerate(o.material_slots) if s.material and DROP_MATERIAL.search(s.material.name)}
    if bad:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        for p in me.polygons:
            p.select = p.material_index in bad
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.delete(type='FACE')
        bpy.ops.object.mode_set(mode='OBJECT')
    # materials: spec/gloss -> principled, glass -> shared, paint -> tintable
    glass = make_glass()
    for i, s in enumerate(o.material_slots):
        m = s.material
        if m is None:
            continue
        if GLASS_MATERIAL.search(m.name):
            s.material = glass
            continue
        if principled(m) is None and m.use_nodes:
            convert_specgloss(m)
        if PAINT_MATERIAL.search(m.name):
            m.name = f'{kind}_paint'
            principled(m).inputs['Base Color'].default_value = (0.85, 0.85, 0.85, 1)
    for s in o.material_slots:
        if s.material and s.material.name != 'vehicle_glass':
            simplify(s.material, s.material.name.endswith('_paint'))
    drop_unused_slots(o)
    keep_render_uv(o)
    if kind == 'crane_truck':
        palette_merge(o, kind)
        drop_unused_slots(o)
    # orientation, scale, decimation
    me.transform(mathutils.Matrix.Rotation(math.radians(yaw), 4, 'Z') @ mathutils.Matrix.Scale(scale, 4))
    me.update()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0002)
    bpy.ops.object.mode_set(mode='OBJECT')
    t0 = tris_of(o)
    if t0 > max_tris:
        dec = o.modifiers.new('cap', 'DECIMATE')
        dec.ratio = max_tris / t0 * 0.98
        dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    me.validate(clean_customdata=False)
    # footprint centre on the ground
    vs = [v.co for v in me.vertices]
    cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    z0 = min(v.z for v in vs)
    me.transform(mathutils.Matrix.Translation((-cx, -cy, -z0)))
    o.location = (0, 0, 0)
    bpy.context.view_layer.update()
    # texture budget
    for s in o.material_slots:
        if not s.material or not s.material.use_nodes:
            continue
        for n in s.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and max(n.image.size) > max_px:
                w, h = n.image.size
                f = max_px / max(w, h)
                n.image.scale(max(1, round(w * f)), max(1, round(h * f)))
    d = o.dimensions
    print(f'VEHICLE {kind} hx={d.x / 2:.2f} hz={d.y / 2:.2f} h={d.z:.2f} tris={tris_of(o)} (from {t0}) '
          f'materials={[s.material.name for s in o.material_slots]}')
    bpy.ops.object.select_all(action='DESELECT')
    return o


def image_key(img):
    px = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(px)
    return (tuple(img.size), hashlib.sha1((px * 255).round().astype(np.uint8).tobytes()).hexdigest())


def dedupe():
    """Merge identical images, then materials with the same base name and identical settings."""
    seen = {}
    for img in list(bpy.data.images):
        if img.users == 0 or img.size[0] == 0:
            continue
        k = image_key(img)
        if k in seen:
            img.user_remap(seen[k])
        else:
            seen[k] = img

    def mat_key(m):
        nodes = []
        for n in m.node_tree.nodes:
            vals = []
            for i in n.inputs:
                if i.is_linked:
                    vals.append((i.identifier, 'L'))
                elif hasattr(i, 'default_value'):
                    v = i.default_value
                    vals.append((i.identifier, tuple(round(x, 4) for x in v) if hasattr(v, '__len__') else round(v, 4)))
            nodes.append((n.bl_idname, getattr(n, 'image', None) and n.image.name, tuple(vals)))
        return (base_name(m.name), m.blend_method, tuple(sorted(nodes, key=str)))

    seen = {}
    for m in list(bpy.data.materials):
        if m.users == 0 or not m.use_nodes:
            continue
        k = mat_key(m)
        if k in seen:
            m.user_remap(seen[k])
        else:
            seen[k] = m
    for m in bpy.data.materials:
        if m.users and base_name(m.name) != m.name and not bpy.data.materials.get(base_name(m.name)):
            m.name = base_name(m.name)


bpy.ops.wm.read_factory_settings(use_empty=True)
built = []
for kind, (uid, yaw, scale, max_tris, max_px) in KINDS.items():
    o = build(kind, uid, yaw, scale, max_tris, max_px)
    o.hide_set(True)
    built.append(o)
dedupe()
for o in built:
    o.hide_set(False)
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
    export_image_format='JPEG', export_jpeg_quality=80, export_materials='EXPORT',
    export_normals=True, export_texcoords=True, export_colors=False, export_yup=True,
)
print('WROTE', OUT)
