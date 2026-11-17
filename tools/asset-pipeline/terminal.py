"""
Build public/assets/props/terminal.glb from the CC0 packs of 3DModelsCC0 (itch.io: city-environment-pack,
free-cc0-city-environment-pack-2, free-cc0-industrial-3d-models, free-cc0-3d-industrial-props-pack-2).

1. Prepare textures (system Python + Pillow):   python3 tools/asset-pipeline/terminal.py prep <packs dir> <work dir>
2. Build the GLB (Blender):  blender -b --factory-startup --python tools/asset-pipeline/terminal.py -- <packs dir> <work dir> <out.glb>

Each source ships an FBX plus Base_Color / Roughness / Metallic / Normal PNGs. Step 1 shrinks them to 512 px,
packs roughness (G) and metallic (B) into one ORM map and flips the green channel of DirectX normal maps.
Step 2 joins each model into ONE node named after its kind, origin at the centre of its footprint on the ground.
"""
import os
import sys

# kind: (pack folder / model folder / file, scale, max triangles)
SOURCES = {
    'water_tower': ('CityEnvPack1/CityEnvPack1/Rooftop_Watertower/Rooftop_Watertower.fbx', 1.0, 3200),
    'dumpster': ('CityEnvPack1/CityEnvPack1/Dumpster/Dumpster.fbx', 1.0, 2500),
    'ac_unit': ('CityEnvPack1/CityEnvPack1/AC_Unit_OutDoor/AC_Unit_Outdoor.fbx', 1.0, 1500),
    'cable_drum': ('IndustrialPack/IndustrialPack/CableDrum/CableDrum.fbx', 1.3, 1500),
    'switchgear': ('IndustrialPack/IndustrialPack/ElectricalBox02/ElectricalBox02.fbx', 1.0, 1500),
    'street_box': ('city2/CityEnviroinmentPack2/Realistic Electrical Box/RealisticElectricalBox.fbx', 1.0, 500),
    'gas_cylinder': ('IndustrialPack/IndustrialPack/Gas_Cylinder/Gas_Cylinder.fbx', 1.0, 800),
    'water_barrel': ('IndustrialPack/IndustrialPack/Water_Barrel/Water_Barrel.fbx', 1.0, 500),
    'light_tower': ('IndustrialPack/IndustrialPack/Worklight02/WorkLight02.fbx', 1.0, 2500),
    'cement_mixer': ('IndustrialPack2/IndustrialPack2/Cement_Mixer/Cement_Mixer.fbx', 1.0, 1800),
    'pallet': ('IndustrialPack2/IndustrialPack2/Wood_Pallet/Wood_Pallet.fbx', 1.0, 400),
    'portaloo': ('city2/CityEnviroinmentPack2/Portaloo/Portaloo.fbx', 1.0, 1500),
    'roadblock': ('city2/CityEnviroinmentPack2/Roadblock02/Roadblock02.fbx', 1.0, 1200),
    'trash_bin': ('city2/CityEnviroinmentPack2/Plastic_Trash_Bin/PlasticTrashBin.fbx', 1.0, 1200),
}
TEX = 512


def find(folder, *keys):
    for f in sorted(os.listdir(folder)):
        low = f.lower()
        if low.endswith('.png') and all(k in low for k in keys):
            return os.path.join(folder, f)
    return None


def prep(packs, work):
    from PIL import Image, ImageOps
    os.makedirs(work, exist_ok=True)
    for kind, (rel, _s, _t) in SOURCES.items():
        folder = os.path.dirname(os.path.join(packs, rel))
        base = find(folder, 'base') or find(folder, 'basemap')
        rough = find(folder, 'rough')
        metal = find(folder, 'metal')
        nor = find(folder, 'normal')
        Image.open(base).convert('RGB').resize((TEX, TEX), Image.LANCZOS).save(f'{work}/{kind}_base.jpg', quality=80)
        r = Image.open(rough).convert('L').resize((TEX, TEX), Image.LANCZOS) if rough else Image.new('L', (TEX, TEX), 200)
        m = Image.open(metal).convert('L').resize((TEX, TEX), Image.LANCZOS) if metal else Image.new('L', (TEX, TEX), 0)
        Image.merge('RGB', (Image.new('L', (TEX, TEX), 255), r, m)).save(f'{work}/{kind}_orm.jpg', quality=80)
        n = Image.open(nor).convert('RGB').resize((TEX, TEX), Image.LANCZOS)
        if 'directx' in os.path.basename(nor).lower():
            rr, gg, bb = n.split()
            n = Image.merge('RGB', (rr, ImageOps.invert(gg), bb))
        n.save(f'{work}/{kind}_nor.jpg', quality=85)
        print('PREP', kind, os.path.basename(base), os.path.basename(nor))


def build(packs, work, out):
    import bpy
    import mathutils

    def material(kind):
        mat = bpy.data.materials.new(kind)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']

        def img(name, colour):
            n = nt.nodes.new('ShaderNodeTexImage')
            n.image = bpy.data.images.load(f'{work}/{kind}_{name}.jpg')
            n.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
            return n

        nt.links.new(img('base', True).outputs['Color'], bsdf.inputs['Base Color'])
        orm = img('orm', False)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(orm.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(img('nor', False).outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        return mat

    bpy.ops.wm.read_factory_settings(use_empty=True)
    for kind, (rel, scale, max_tris) in SOURCES.items():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=os.path.join(packs, rel))
        new = [o for o in bpy.data.objects if o not in before]
        meshes = [o for o in new if o.type == 'MESH']
        for o in new:
            if o not in meshes:
                bpy.data.objects.remove(o, do_unlink=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if len(meshes) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = kind
        o.data.name = kind
        o.data.materials.clear()
        o.data.materials.append(material(kind))
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
        bpy.context.view_layer.update()
        d = o.dimensions
        print(f'PROP {kind} width(x)={d.x:.2f} depth(y)={d.y:.2f} height(z)={d.z:.2f} tris={sum(len(p.vertices) - 2 for p in o.data.polygons)}')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_apply=True,
        export_image_format='JPEG', export_jpeg_quality=78, export_yup=True,
    )
    print('WROTE', out)


if __name__ == '__main__':
    if '--' in sys.argv:
        a = sys.argv[sys.argv.index('--') + 1:]
        build(a[0], a[1], a[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == 'prep':
        prep(sys.argv[2], sys.argv[3])
