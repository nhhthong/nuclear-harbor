"""
Build public/assets/props/industrial.glb from Poly Haven CC0 models (glTF, 1k textures).

    blender -b --factory-startup --python tools/asset-pipeline/industrial.py -- <polyhaven src dir> <out.glb>

<src dir>/<asset id>/<asset id>_1k.gltf as downloaded from https://polyhaven.com (api.polyhaven.com/files/<id>).
Every prop becomes ONE node named after its kind: parts joined, scaled to metres, origin at the centre of its
footprint on the ground. Heavy meshes are decimated and textures downscaled so the whole file stays small.
"""
import math
import sys
import bpy
import mathutils

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]

# kind: (asset id, object name filter or None, scale, max triangles, texture size)
KINDS = {
    'cabinet_a': ('utility_box_01', None, 1.35, 3000, 512),
    'cabinet_b': ('utility_box_02', None, 1.35, 3000, 512),
    'barrier': ('concrete_road_barrier_02', None, 1.0, 2500, 512),
    'barrel_red': ('Barrel_01', None, 1.0, 1500, 512),
    'barrel_blue': ('barrel_03', None, 1.0, 1500, 512),
    'tyre': ('old_tyre', None, 1.0, 900, 512),
    'generator': ('portable_generator', None, 1.0, 3500, 512),
    'worklight': ('flood_lights', 'flood_lights_standing_double_a', 1.0, 4000, 512),
}

shrunk = set()


def shrink_images(obj, size):
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.name not in shrunk:
                img = n.image
                if img.size[0] > size:
                    img.scale(size, size)
                shrunk.add(img.name)


def build(kind, asset, name_filter, scale, max_tris, tex):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f'{SRC}/{asset}/{asset}_1k.gltf')
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if o.type == 'MESH' and (name_filter is None or o.name.startswith(name_filter))]
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:
        o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(keep) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = kind
    o.data.name = kind
    # drop small glass parts (their textures would ship as PNG with alpha)
    glass = [i for i, sl in enumerate(o.material_slots) if sl.material and 'glass' in sl.material.name]
    if glass:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bpy.ops.object.mode_set(mode='OBJECT')
        for poly in o.data.polygons:
            poly.select = poly.material_index in glass
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.delete(type='FACE')
        bpy.ops.object.mode_set(mode='OBJECT')
        for i in sorted(glass, reverse=True):
            o.active_material_index = i
            bpy.ops.object.material_slot_remove()
    if kind == 'tyre':  # the scan stands on its tread: lay it flat
        o.data.transform(mathutils.Matrix.Rotation(math.pi / 2, 4, 'X'))
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > max_tris:
        dec = o.modifiers.new('cap', 'DECIMATE')
        dec.ratio = max_tris / tris
        bpy.ops.object.modifier_apply(modifier=dec.name)
    ws = [mathutils.Vector(c) for c in o.bound_box]
    cx = (min(v.x for v in ws) + max(v.x for v in ws)) / 2
    cy = (min(v.y for v in ws) + max(v.y for v in ws)) / 2
    z0 = min(v.z for v in ws)
    o.data.transform(mathutils.Matrix.Translation((-cx, -cy, -z0)))
    o.data.transform(mathutils.Matrix.Scale(scale, 4))
    o.location = (0, 0, 0)
    shrink_images(o, tex)
    bpy.context.view_layer.update()
    d = o.dimensions
    print(f'PROP {kind} width(x)={d.x:.2f} depth(y)={d.y:.2f} height(z)={d.z:.2f} tris={sum(len(p.vertices) - 2 for p in o.data.polygons)}')
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
for kind, spec in KINDS.items():
    build(kind, *spec)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
    export_image_format='JPEG', export_jpeg_quality=72, export_yup=True,
)
print('WROTE', OUT)
