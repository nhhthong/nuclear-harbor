"""
Build public/assets/props/warehouse.glb: the interior props of the warehouse (spec 29, stream C).

    blender -b --factory-startup --python tools/asset-pipeline/warehouse_props.py -- <raw dir> <out.glb>
    python3 tools/asset-pipeline/quantize_normals.py <out.glb> public/assets/props/warehouse.glb

<raw dir>/<name>/ holds one download per source (never committed, see docs/ASSETS.md):
  Poly Haven (CC0, https://polyhaven.com/a/<id>, glTF 1k from api.polyhaven.com/files/<id>), saved as
  <raw>/<id>/<id>_1k.gltf + textures/: cardboard_box_01, wooden_crate_01, wooden_crate_02, plastic_crate_01,
  Barrel_02, metal_jerrycan, propane_tank, tool_cart, portable_welding_cart, metal_tool_chest, bench_vice_01,
  ladder_sectioned_01, metal_office_desk, drawer_cabinet, metal_stool_01, binder_notebook, metal_trash_can,
  korean_fire_extinguisher_01, hanging_industrial_lamp, WetFloorSign_01, cement_bag.
  Sketchfab (CC BY 4.0, GLB from api.sketchfab.com/v3/models/<uid>/download), saved as <raw>/<name>/model.glb:
    pallet_jack     "Low Poly Pallet Jack" by Monke (cosmiccobra)     5b0b9b7b1e1640cf9804588a763cc9f1
    ibc_tank        "IBC Tank" by DartleDyan                          55723c0e512242e989dbb996fbef095e
    wooden_pallets  "Wooden Pallets" by YadroGames                    dba5c00928cd400796d9f6fffdd724b3
    computer_desk   "Low Poly Computer Desk" by Glowbox 3D            c67f61fa444044bcb88ec3e28f0ca7ac

Every prop becomes ONE node named after its kind (the names in src/structures/warehouseProps.ts): parts joined,
Y up, metres, origin at the centre of its footprint on the ground, front facing -Z (glTF). Secondary materials
are dropped (one material = one draw call per instanced kind) except the lamp, whose glass stays as a second
primitive so the game can make it glow. Meshes are decimated to `max_tris` and textures downscaled (512 px for
big props, 256 px for hand-sized ones; normal maps dropped on the smallest) so the file stays near 1.5 MB.
"""
import math
import os
import sys

import bpy
import mathutils

# kind: dict(src=raw folder, file, keep=object name prefixes or None, drop=name substrings, scale or fit=(axis, metres),
#            tris=max triangles, tex=texture px, nor=keep normal map, yaw=degrees about up applied after centring)
PH = lambda i: dict(src=i, file=f'{i}_1k.gltf')  # noqa: E731
SF = lambda n: dict(src=n, file='model.glb')  # noqa: E731
KINDS = {
    'cardboard_box': {**PH('cardboard_box_01'), 'tris': 150, 'tex': 256, 'nor': False},
    'wooden_crate': {**PH('wooden_crate_01'), 'tris': 300, 'tex': 512, 'nor': True},
    'long_crate': {**PH('wooden_crate_02'), 'tris': 300, 'tex': 512, 'nor': True},
    'plastic_crate': {**PH('plastic_crate_01'), 'tris': 600, 'tex': 256, 'nor': False},
    'barrel': {**PH('Barrel_02'), 'tris': 700, 'tex': 512, 'nor': True},
    'jerrycan': {**PH('metal_jerrycan'), 'tris': 500, 'tex': 256, 'nor': False},
    'propane_tank': {**PH('propane_tank'), 'tris': 600, 'tex': 256, 'nor': False},
    'tool_cart': {**PH('tool_cart'), 'tris': 1200, 'tex': 512, 'nor': True},
    'welding_cart': {**PH('portable_welding_cart'), 'tris': 1200, 'tex': 512, 'nor': True},
    'tool_chest': {**PH('metal_tool_chest'), 'tris': 900, 'tex': 256, 'nor': False},
    'bench_vice': {**PH('bench_vice_01'), 'drop': ['Icosphere'], 'tris': 600, 'tex': 256, 'nor': False},
    'ladder': {**PH('ladder_sectioned_01'), 'tris': 1200, 'tex': 256, 'nor': False},
    'office_desk': {**PH('metal_office_desk'), 'tris': 1200, 'tex': 512, 'nor': True},
    'drawer_cabinet': {**PH('drawer_cabinet'), 'tris': 2000, 'tex': 512, 'nor': True},
    'stool': {**PH('metal_stool_01'), 'tris': 600, 'tex': 256, 'nor': False},
    'binder': {**PH('binder_notebook'), 'keep': ['binder_notebook_closed'], 'tris': 200, 'tex': 256, 'nor': False},
    'trash_can': {**PH('metal_trash_can'), 'drop': ['rust'], 'tris': 700, 'tex': 256, 'nor': False},
    'extinguisher': {**PH('korean_fire_extinguisher_01'), 'tris': 600, 'tex': 256, 'nor': False},
    'lamp': {**PH('hanging_industrial_lamp'), 'tris': 900, 'tex': 256, 'nor': False},
    'wet_floor_sign': {**PH('WetFloorSign_01'), 'tris': 228, 'tex': 256, 'nor': False},
    'cement_bag': {**PH('cement_bag'), 'tris': 400, 'tex': 256, 'nor': False},
    'pallet_jack': {**SF('pallet_jack'), 'fit': ('z', 1.25), 'tris': 1200, 'tex': 512, 'nor': True},
    'ibc_tank': {**SF('ibc_tank'), 'fit': ('z', 1.16), 'tris': 1200, 'tex': 512, 'nor': True},
    'pallet': {**SF('wooden_pallets'), 'keep': ['Pallet_1'], 'fit': ('x', 1.2), 'tris': 400, 'tex': 512, 'nor': False},
    'computer_desk': {**SF('computer_desk'), 'fit': ('y', 1.5), 'tris': 1200, 'tex': 512, 'nor': True},
}
# front of the source after import (Blender axes) -> rotate so the front faces Blender +Y (= glTF -Z)
YAW = {'computer_desk': 90, 'pallet_jack': 0, 'ibc_tank': 0, 'pallet': 0}
DEFAULT_YAW = 180  # Poly Haven scans face Blender -Y (glTF +Z)
JPEG_QUALITY = 72
done_images = set()


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def delete_faces(o, pred):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons:
        p.select = pred(p)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')


def tidy_materials(o, keep_glass):
    """Keep the material that covers most faces (and the glass for the lamp); delete faces of the others."""
    counts = {}
    for p in o.data.polygons:
        counts[p.material_index] = counts.get(p.material_index, 0) + 1
    main = max(counts, key=counts.get)
    keep = {main}
    if keep_glass:
        keep |= {i for i, s in enumerate(o.material_slots) if s.material and 'glass' in s.material.name}
    if len(counts) > 1 and set(counts) - keep:
        delete_faces(o, lambda p: p.material_index not in keep)
    for i in sorted(range(len(o.material_slots)), reverse=True):
        if i not in keep:
            o.active_material_index = i
            bpy.ops.object.material_slot_remove()


def metal_rough(o):
    """Sketchfab's specular-glossiness materials import without a Principled BSDF and would export blank:
    rebuild them as metallic-roughness from the colour texture (rough, non-metal wood/plastic)."""
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes or m.node_tree.nodes.get('Principled BSDF'):
            continue
        colour = next((n.image for n in m.node_tree.nodes
                       if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB'), None)
        new = bpy.data.materials.new(m.name + '_mr')
        new.use_nodes = True
        bsdf = new.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.85
        bsdf.inputs['Metallic'].default_value = 0.0
        if colour:
            tex = new.node_tree.nodes.new('ShaderNodeTexImage')
            tex.image = colour
            new.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        slot.material = new


def shrink(o, size, keep_normal):
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type == 'NORMAL_MAP' and not keep_normal:
                nt.nodes.remove(n)
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.name not in done_images:
                # roughness/metallic maps (they feed a Separate Color node) ship at half size
                orm = any(l.to_node.type in ('SEPARATE_COLOR', 'SEPRGB') for out in n.outputs for l in out.links)
                px = size // 2 if orm else size
                if n.image.size[0] > px or n.image.size[1] > px:
                    n.image.scale(px, px)
                done_images.add(n.image.name)
        if 'glass' in m.name:  # lamp glass: plain warm emissive, no transmission (the game swaps in a glow material)
            b = nt.nodes.get('Principled BSDF')
            if b:
                b.inputs['Transmission Weight'].default_value = 0.0
                b.inputs['Base Color'].default_value = (1.0, 0.85, 0.6, 1.0)
                b.inputs['Emission Color'].default_value = (1.0, 0.85, 0.6, 1.0)
                b.inputs['Emission Strength'].default_value = 1.0


def build(raw, kind, k):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(raw, k['src'], k['file']))
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if o.type == 'MESH'
            and (not k.get('keep') or any(o.name.startswith(p) for p in k['keep']))
            and not any(s in o.name for s in k.get('drop', []))]
    bpy.context.view_layer.update()
    mats = {o: o.matrix_world.copy() for o in keep}
    for o in keep:
        o.parent = None
        o.matrix_world = mats[o]
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    select_only(keep)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(keep) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = kind
    o.data.name = kind
    tidy_materials(o, keep_glass=(kind == 'lamp'))
    metal_rough(o)
    t = tris_of(o)
    if t > k['tris']:
        dec = o.modifiers.new('cap', 'DECIMATE')
        dec.ratio = k['tris'] / t
        bpy.ops.object.modifier_apply(modifier=dec.name)
    ws = [mathutils.Vector(c) for c in o.bound_box]
    lo = [min(v[i] for v in ws) for i in range(3)]
    hi = [max(v[i] for v in ws) for i in range(3)]
    o.data.transform(mathutils.Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))
    scale = k.get('scale', 1.0)
    if 'fit' in k:
        axis, metres = k['fit']
        scale = metres / (hi['xyz'.index(axis)] - lo['xyz'.index(axis)])
    o.data.transform(mathutils.Matrix.Scale(scale, 4))
    o.data.transform(mathutils.Matrix.Rotation(math.radians(YAW.get(kind, DEFAULT_YAW)), 4, 'Z'))
    o.location = (0, 0, 0)
    shrink(o, k['tex'], k['nor'])
    bpy.context.view_layer.update()
    d = o.dimensions
    # Blender x -> glTF x, Blender y -> glTF -z, Blender z -> glTF y
    print(f'PROP {kind} w(x)={d.x:.2f} d(z)={d.y:.2f} h(y)={d.z:.2f} tris={tris_of(o)} mats={len(o.material_slots)}')
    return o


def main():
    raw, out = sys.argv[sys.argv.index('--') + 1:][:2]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for kind, k in KINDS.items():
        build(raw, kind, k)
    # orphaned images of dropped parts must not ship
    for img in list(bpy.data.images):
        if img.users == 0:
            bpy.data.images.remove(img)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_apply=True,
        export_image_format='JPEG', export_jpeg_quality=JPEG_QUALITY, export_yup=True,
    )
    print('WROTE', out, sum(tris_of(o) for o in bpy.data.objects if o.type == 'MESH'), 'tris')


if __name__ == '__main__':
    main()
