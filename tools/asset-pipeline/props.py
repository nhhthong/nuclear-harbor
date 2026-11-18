"""
Superseded by vehicles_sf.py (kept for history). Built the old public/assets/props/vehicles.glb from the CC0 / CC-BY sources once listed in docs/ASSETS.md.

    blender -b --factory-startup --python tools/asset-pipeline/props.py -- <vehicles pack dir> <forklift.blend> <out.glb>

Every vehicle becomes ONE mesh node (name = prop id): parts joined, scaled to metres, origin at the
centre of its footprint on the ground, length along the glTF Z axis. Material colours are baked into a
vertex colour attribute so the game can draw each vehicle with one shared material (one draw call).
"""
import sys
import bpy
import mathutils

args = sys.argv[sys.argv.index('--') + 1:]
PACK, FORKLIFT, OUT = args[0], args[1], args[2]

# id: (source, scale). The toy-proportioned pack is scaled to a believable length; the forklift is about 1.45x real size.
SOURCES = {
    'truck': (f'{PACK}/Truck/Truck.fbx', 0.95),
    'semi': (f'{PACK}/Truck with trailer/Truck with trailer.fbx', 0.95),
    'van': (f'{PACK}/Van/Van.fbx', 0.82),
    'pickup': (f'{PACK}/Pickup/Pickup.fbx', 0.82),
    'suv': (f'{PACK}/SUV/SUV.fbx', 0.82),
    'sedan': (f'{PACK}/Sedan/Sedan.fbx', 0.82),
    'hatchback': (f'{PACK}/Hatchback/Hatchback.fbx', 0.82),
    'forklift': (FORKLIFT, 0.7),
}


MAX_TRIS = 4500


def linear(c):
    return tuple(c[:3])


def material_colour(mat):
    if mat is None:
        return (0.05, 0.05, 0.05)
    if mat.use_nodes:
        for n in mat.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                return linear(n.inputs['Base Color'].default_value)
    return linear(mat.diffuse_color)


def import_source(path):
    before = set(bpy.data.objects)
    if path.endswith('.blend'):
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        for o in dst.objects:
            if o is not None:
                bpy.context.scene.collection.objects.link(o)
    else:
        bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def build(pid, path, scale):
    objs = import_source(path)
    meshes = []
    for o in objs:
        if o.type != 'MESH':
            continue
        dims = o.dimensions
        if len(o.data.polygons) <= 2 and max(dims) > 6:  # studio floor plane
            continue
        meshes.append(o)
    for o in objs:
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        # bake modifiers (joining drops them); subdivision dropped to keep the triangle count low
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            if m.type == 'SUBSURF':
                o.modifiers.remove(m)
                continue
            bpy.ops.object.modifier_apply(modifier=m.name)
    for o in meshes:
        # bake material colours into a face-corner colour attribute
        me = o.data
        if not me.color_attributes.get('Col'):
            me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        attr = me.color_attributes['Col']
        cols = [material_colour(s.material) for s in o.material_slots] or [(0.5, 0.5, 0.5)]
        for poly in me.polygons:
            c = cols[min(poly.material_index, len(cols) - 1)]
            for li in poly.loop_indices:
                attr.data[li].color = (c[0], c[1], c[2], 1.0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = pid
    o.data.name = pid
    o.data.materials.clear()
    o.data.color_attributes.active_color = o.data.color_attributes['Col']
    # weld the joined parts and cap heavy sources (the forklift has bevelled, mirrored wheels)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode='OBJECT')
    tris0 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris0 > MAX_TRIS:
        dec = o.modifiers.new('cap', 'DECIMATE')
        dec.ratio = MAX_TRIS / tris0
        bpy.ops.object.modifier_apply(modifier=dec.name)
    # footprint centre on the ground, then metric scale
    ws = [mathutils.Vector(c) for c in o.bound_box]
    cx = (min(v.x for v in ws) + max(v.x for v in ws)) / 2
    cy = (min(v.y for v in ws) + max(v.y for v in ws)) / 2
    z0 = min(v.z for v in ws)
    o.data.transform(mathutils.Matrix.Translation((-cx, -cy, -z0)))
    o.data.transform(mathutils.Matrix.Scale(scale, 4))
    o.location = (0, 0, 0)
    bpy.context.view_layer.update()
    d = o.dimensions
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    print(f'PROP {pid} size x={d.x:.2f} y(len)={d.y:.2f} z(h)={d.z:.2f} tris={tris}')
    o.hide_set(True)
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
built = [build(pid, p, s) for pid, (p, s) in SOURCES.items()]
# every node stays at the origin: the game uses each mesh as instanced geometry
for o in built:
    o.hide_set(False)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
    export_colors=True, export_materials='NONE', export_normals=False, export_texcoords=False,
    export_yup=True,
)
print('WROTE', OUT)
