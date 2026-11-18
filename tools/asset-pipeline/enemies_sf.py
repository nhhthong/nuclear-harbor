"""
Build the three authored robot GLBs of the enemy roster (spec 26).

    blender -b --factory-startup --python tools/asset-pipeline/enemies_sf.py -- <biped|striker|spot> <raw.glb> <out.glb>

Sources (Sketchfab, all CC-BY 4.0, see docs/ASSETS.md):
- biped   "Biped robot" by skudgee (uid 801d2a245e4a4405a0c2152b35b5e486): display base removed, run / crouch /
          leap / claw clips authored here on the original skeleton (the source has one idle clip only).
- striker "Medium Mech Striker" by MSGDI (uid 27ba717c173a40b7841d2f2c6a89d823): 41 source clips, three kept
          (idle, walk, run).
- spot    "Walking Robotic Dog" by reececreoplan (uid cb8157f40d39456d9f37865b4e6e7477): the four leg walk cycles
          are baked into one clip, the body bob is dropped.

Output (game frame: +Y up, the robot faces -Z, metres, feet at y = 0): skinned meshes, one skeleton per leg group,
named clips, <= 8k triangles, 512 px JPEG textures (base colour, and emission for the striker).
"""
import math
import sys
import bpy
import mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
KIND, RAW, OUT = argv[0], argv[1], argv[2]
TEX = 512
FPS = 24

CONFIG = {
    # height / length target (m), tri targets per mesh object, materials
    'biped': dict(size=2.2, axis='z', tris={'Object_7': 3500, 'Object_8': 1700, 'Object_9': 2400}),
    'striker': dict(size=3.6, axis='z', tris={'Object_7': 5700, 'Object_8': 2100}),
    'spot': dict(size=1.25, axis='z', tris={'Object_46': 3500, 'Object_9': 1100, 'Object_19': 1100, 'Object_29': 1100, 'Object_40': 1100}),
}[KIND]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW, merge_vertices=True)
bpy.context.view_layer.update()
sc = bpy.context.scene
sc.render.fps = FPS
O = bpy.data.objects


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ---- 1. junk: bone-shape icospheres made by the importer, the biped's display base --------------------------
for o in list(O):
    if o.name.startswith('Icosphere') or o.name.startswith('Ground'):
        bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in O if o.type == 'MESH']

# ---- 2. decimate (collapse keeps the vertex groups) ------------------------------------------------------------
for o in meshes:
    target = CONFIG['tris'][o.name]
    before = tri_count(o)
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects:
        s.select_set(False)
    o.select_set(True)
    me = o.data
    if me.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    mod = o.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, target / before)
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in me.polygons:
        p.use_smooth = True
    me.use_auto_smooth = True
    me.auto_smooth_angle = math.radians(80)
    print('DECIMATE', o.name, before, '->', tri_count(o))


# ---- 3. materials: base colour (+ emission) at 512 px, constant metal / rough --------------------------------------
def image(name):
    img = bpy.data.images[name]
    if img.size[0] > TEX:
        img.scale(TEX, TEX)
    return img


def make_mat(name, base, emis=None, metallic=0.3, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = image(base)
    nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if emis:
        e = nt.nodes.new('ShaderNodeTexImage')
        e.image = image(emis)
        nt.links.new(e.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 1.0
    else:
        bsdf.inputs['Emission Strength'].default_value = 0.0
    return m


if KIND == 'biped':
    specs = {'Object_7': ('Metal', 'Image_0', None, 0.5, 0.5), 'Object_8': ('Paint', 'Image_4', None, 0.25, 0.55), 'Object_9': ('Plastic', 'Image_8', None, 0.1, 0.65)}
elif KIND == 'striker':
    specs = {'Object_7': ('Striker', 'Image_0', 'Image_2', 0.3, 0.55), 'Object_8': ('StrikerWeapons', 'Image_4', 'Image_6', 0.3, 0.55)}
else:
    specs = {n: ('SpotBody', 'Image_0', None, 0.25, 0.55) for n in CONFIG['tris']}
cache = {}
for o in meshes:
    nm, base, emis, mt, rg = specs[o.name]
    if nm not in cache:
        cache[nm] = make_mat(nm, base, emis, mt, rg)
    o.data.materials.clear()
    o.data.materials.append(cache[nm])
for img in list(bpy.data.images):
    if img.users == 0:
        bpy.data.images.remove(img)


# ---- 4. animation -------------------------------------------------------------------------------------------------
def set_action(arm, action):
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = action


def new_action(arm, name):
    a = bpy.data.actions.new(name)
    a.use_fake_user = True
    set_action(arm, a)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return a


class Poser:
    """Poses bones by model-space (armature-space) rotations about X (side), Y (forward) and Z (up) and
    translations, converted to each bone's local frame through its rest matrix (see the derivation in spec 26)."""

    def __init__(self, arm):
        self.arm = arm
        self.rot = {}
        self.loc = {}

    def reset(self):
        self.rot.clear()
        self.loc.clear()

    def rotate(self, bone, axis, angle):
        r = self.rot.setdefault(bone, mathutils.Matrix.Identity(3))
        self.rot[bone] = mathutils.Matrix.Rotation(angle, 3, axis) @ r

    def move(self, bone, v):
        self.loc[bone] = mathutils.Vector(self.loc.get(bone, mathutils.Vector())) + mathutils.Vector(v)

    def key(self, frame):
        for pb in self.arm.pose.bones:
            m3 = pb.bone.matrix_local.to_3x3()
            inv = m3.inverted()
            r = self.rot.get(pb.name)
            q = (inv @ r @ m3).to_quaternion() if r is not None else mathutils.Quaternion()
            pb.rotation_quaternion = q
            pb.location = inv @ self.loc[pb.name] if pb.name in self.loc else mathutils.Vector()
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('location', frame=frame)


def finish_action(a, loop=True):
    for fc in a.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR' if not loop else 'BEZIER'


def author_biped(arm):
    P = Poser(arm)
    SP1, ROOT = 'Bip001 Spine1_014', 'Bip001_01'
    L = dict(thigh='Bip001 L Thigh_04', calf='Bip001 L Calf_05', foot='Bip001 L Foot_07', arm='Bip001 L UpperArm_017', fore='Bip001 L Forearm_018')
    R = dict(thigh='Bip001 R Thigh_09', calf='Bip001 R Calf_010', foot='Bip001 R Foot_012', arm='Bip001 R UpperArm_029', fore='Bip001 R Forearm_030')

    def leg(side, th, ca):
        P.rotate(side['thigh'], 'X', th)
        P.rotate(side['calf'], 'X', ca)
        P.rotate(side['foot'], 'X', -(th + ca) * 0.75)

    # run: 24 frames per cycle, left leg at phase p, right at p + pi; angles are model-space (+X = backwards swing)
    a = new_action(arm, 'run')
    n = 24
    for f in range(n + 1):
        p = 2 * math.pi * f / n
        P.reset()
        for side, ph, arm_ph in ((L, p, p + math.pi), (R, p + math.pi, p)):
            leg(side, 0.62 * math.sin(ph), 1.05 * max(0.0, -math.sin(ph)) + 0.15)
            P.rotate(side['arm'], 'X', 0.75 * math.sin(arm_ph) - 0.15)
            P.rotate(side['fore'], 'X', -0.9 - 0.35 * math.sin(arm_ph))
        P.rotate(SP1, 'X', 0.28)
        P.rotate(SP1, 'Z', 0.12 * math.sin(p))
        P.move(ROOT, (0, 0, -4.0 + 3.0 * math.cos(2 * p)))
        P.key(1 + f)
    a.use_fake_user = True

    # crouch: 12 frames down into the pose, then 12 held (the game plays it once and clamps)
    a = new_action(arm, 'crouch')
    for f, k in ((0, 0.0), (11, 1.0), (12, 1.0)):
        P.reset()
        for side in (L, R):
            leg(side, -0.85 * k, 1.5 * k)
            P.rotate(side['arm'], 'X', 0.7 * k)
            P.rotate(side['fore'], 'X', -0.7 * k)
        P.rotate(SP1, 'X', 0.4 * k)
        P.move(ROOT, (0, 0, -26.0 * k))
        P.key(1 + f)

    # leap: airborne pose, arms thrust forward with the claws out, legs tucked (clamped hold)
    a = new_action(arm, 'leap')
    for f, k in ((0, 0.0), (6, 1.0), (12, 1.0)):
        P.reset()
        for side in (L, R):
            leg(side, -0.7 * k, 1.1 * k)
            P.rotate(side['arm'], 'X', -1.45 * k)
            P.rotate(side['fore'], 'X', -0.25 * k)
        P.rotate(SP1, 'X', 0.35 * k)
        P.move(ROOT, (0, 0, -8.0 * k))
        P.key(1 + f)

    # claw: two quick swipes, left then right (14 frames, played once)
    a = new_action(arm, 'claw')
    frames = [
        (0, 0.0, 0.0, 0.0), (3, 1.0, 0.0, 0.5), (6, -1.0, 0.0, 0.0), (9, 0.0, 1.0, -0.5), (12, 0.0, -1.0, 0.0), (15, 0.0, 0.0, 0.0),
    ]
    for f, l, r, twist in frames:
        P.reset()
        # l, r: +1 = arm cocked back and out, -1 = arm slashed forward and across
        for side, v, sgn in ((L, l, 1.0), (R, r, -1.0)):
            P.rotate(side['arm'], 'X', -0.9 + (0.5 * v if v > 0 else 0.9 * v))
            P.rotate(side['arm'], 'Z', sgn * (0.6 * v if v > 0 else 0.9 * v))
            P.rotate(side['fore'], 'X', -0.6 - (0.5 * v if v > 0 else 0.0))
        P.rotate(SP1, 'Z', 0.4 * twist)
        P.rotate(SP1, 'X', 0.15)
        P.key(1 + f)
    return ['idle', 'run', 'crouch', 'leap', 'claw']


def pick_actions(arm, keep):
    """keep: {source-prefix: new name}"""
    for a in list(bpy.data.actions):
        match = next((nn for src, nn in keep.items() if a.name.startswith(src + '_') or a.name == src), None)
        if match is None:
            bpy.data.actions.remove(a)
        else:
            a.name = match
            a.use_fake_user = True
    return list(keep.values())


# the importer wraps each source clip in an NLA track named like the glTF animation: drop them, the exporter would
# take the track names for the clips instead of the action names
for o in O:
    if o.animation_data:
        for t in list(o.animation_data.nla_tracks):
            o.animation_data.nla_tracks.remove(t)
arm = next((a for a in O if a.type == 'ARMATURE'), None)
clips = []
if KIND == 'biped':
    idle = bpy.data.actions['Robot_Soldat_Object_4']
    idle.name = 'idle'
    idle.use_fake_user = True
    clips = author_biped(arm)
elif KIND == 'striker':
    clips = pick_actions(arm, {'a4IdlePose_Object_4': 'idle', 'a5WalkCycle_Object_4': 'walk', 'a7RunCycle_Object_4': 'run'})
    # a few anchors of the source also hold the exact names "...RootMotion": removed above (prefix match is exact)
else:
    body = O.get('SPOT_BODY_51')
    if body is not None:
        body.animation_data_clear()
    for a in list(bpy.data.actions):
        if a.name.startswith('Animation_SPOT_BODY'):
            bpy.data.actions.remove(a)
    sc.frame_start, sc.frame_end = 1, 151
    sc.name = 'walk'
    clips = ['walk']

# one NLA track per clip (the exporter's NLA mode handles every action the same way; its plain actions mode
# converted the translation channels of the non-active clips with the wrong axes)
if KIND != 'spot':
    arm.animation_data.action = None
    for name in clips:
        tr = arm.animation_data.nla_tracks.new()
        tr.name = name
        st = tr.strips.new(name, int(bpy.data.actions[name].frame_range[0]), bpy.data.actions[name])
        st.name = name

# ---- 5. scale, orient, feet on the ground ----------------------------------------------------------------------------
sc.frame_set(1)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
mn = mathutils.Vector((1e9,) * 3)
mx = -mn
for o in [m for m in O if m.type == 'MESH']:
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    for v in me.vertices:
        w = oe.matrix_world @ v.co
        mn = mathutils.Vector(map(min, mn, w))
        mx = mathutils.Vector(map(max, mx, w))
    oe.to_mesh_clear()
height = mx.z - mn.z
s = CONFIG['size'] / height
print('BOUNDS', tuple(mn), tuple(mx), 'scale', s)

root = bpy.data.objects.new('robot_root', None)
sc.collection.objects.link(root)
tops = [o for o in O if o.parent is None and o is not root]
for o in tops:
    o.parent = root
    o.matrix_parent_inverse = mathutils.Matrix.Identity(4)
# every source here faces -Y in Blender (+Z in glTF); the game frame faces -Z: turn 180 degrees about the up axis
if not __import__('os').environ.get('NOROOT'):
    root.matrix_world = mathutils.Matrix.Translation((0, 0, -mn.z * s)) @ mathutils.Matrix.Rotation(math.pi, 4, 'Z') @ mathutils.Matrix.Scale(s, 4)
bpy.context.view_layer.update()

# ---- 6. export --------------------------------------------------------------------------------------------------------------
total = sum(tri_count(o) for o in O if o.type == 'MESH')
print('TRIANGLES', total, 'CLIPS', clips)
kw = dict(
    filepath=OUT,
    export_format='GLB',
    export_image_format='JPEG',
    export_jpeg_quality=78,
    export_skins=True,
    export_apply=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_animations=True,
    export_animation_mode='SCENE' if KIND == 'spot' else 'NLA_TRACKS',
    export_optimize_animation_size=True,
    export_force_sampling=True,
)
bpy.ops.export_scene.gltf(**kw)


def fix_translations(path, node_name):
    """Blender 4.0 writes the pelvis translation of the imported (non-idle) striker clips in the source's Z-up frame
    while the rest pose is in Y-up: swizzle (x, y, z) -> (x, z, -y) where that brings the value closer to the rest."""
    import json
    import struct
    data = bytearray(open(path, 'rb').read())
    jl = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(bytes(data[20:20 + jl]))
    binoff = 20 + jl + 8
    idx = next(i for i, n in enumerate(j['nodes']) if n.get('name') == node_name)
    rest = j['nodes'][idx]['translation']
    fixed = []
    for anim in j['animations']:
        for ch in anim['channels']:
            if ch['target']['node'] != idx or ch['target']['path'] != 'translation':
                continue
            acc = j['accessors'][anim['samplers'][ch['sampler']]['output']]
            bv = j['bufferViews'][acc['bufferView']]
            off = binoff + bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
            vals = list(struct.unpack_from('<%df' % (acc['count'] * 3), data, off))
            d0 = sum(abs(vals[i] - rest[i % 3]) for i in range(len(vals)))
            sw = []
            for i in range(0, len(vals), 3):
                sw += [vals[i], vals[i + 2], -vals[i + 1]]
            d1 = sum(abs(sw[i] - rest[i % 3]) for i in range(len(sw)))
            if d1 < d0:
                struct.pack_into('<%df' % len(sw), data, off, *sw)
                acc['min'] = [min(sw[k::3]) for k in range(3)]
                acc['max'] = [max(sw[k::3]) for k in range(3)]
                fixed.append(anim['name'])
    nj = json.dumps(j, separators=(',', ':')).encode()
    nj += b' ' * (-len(nj) % 4)
    out = bytearray(data[:12]) + struct.pack('<II', len(nj), 0x4E4F534A) + nj + data[20 + jl:]
    struct.pack_into('<I', out, 8, len(out))
    open(path, 'wb').write(out)
    print('FIXED pelvis translation in', fixed)


if KIND == 'striker':
    fix_translations(OUT, 'LowerTorso_07')
print('WROTE', OUT)
