"""Convert a GoldSrc view model (MDL v10) to a skinned, animated GLB.

Usage: python3 -I convert.py <input.mdl> <output.glb> [report.json]

Units: inches -> metres. Axes: GoldSrc (X forward, Y left, Z up) -> glTF (-Z forward, +Y up).
All body parts (hands + weapon pieces) are merged into one skinned mesh with one texture atlas,
so the model costs a single draw call.
"""
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb  # noqa: E402
import mdl  # noqa: E402

SCALE = 0.0254
ATLAS_W = 1024
PAD = 4
TEX_DIV = 2  # downscale factor for textures

# GoldSrc -> glTF axis map: (x, y, z) -> (-y, z, -x)
M = ((0, -1, 0), (0, 0, 1), (-1, 0, 0))


def mat_vec(m, v):
    return tuple(sum(m[i][j] * v[j] for j in range(3)) for i in range(3))


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def quat_rot(q, v):
    x, y, z, w = q
    # v' = v + 2w(q x v) + 2 q x (q x v)
    cx = y * v[2] - z * v[1]
    cy = z * v[0] - x * v[2]
    cz = x * v[1] - y * v[0]
    dx = y * cz - z * cy
    dy = z * cx - x * cz
    dz = x * cy - y * cx
    return (v[0] + 2 * (w * cx + dx), v[1] + 2 * (w * cy + dy), v[2] + 2 * (w * cz + dz))


def mat_to_quat(m):
    t = m[0][0] + m[1][1] + m[2][2]
    if t > 0:
        s = math.sqrt(t + 1) * 2
        return ((m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, 0.25 * s)
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2
        return (0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s)
    if m[1][1] > m[2][2]:
        s = math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2
        return ((m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s)
    s = math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2
    return ((m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s)


QM = mat_to_quat(M)


def quat_conj(q):
    return (-q[0], -q[1], -q[2], q[3])


def to_rgba(tex):
    out = bytearray()
    for p in tex.pixels:
        r, g, b = tex.palette[p]
        out += bytes((r, g, b, 255))
    return out


def downscale(rgba, w, h, div):
    nw, nh = max(1, w // div), max(1, h // div)
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        for x in range(nw):
            acc = [0, 0, 0, 0]
            for dy in range(div):
                for dx in range(div):
                    o = ((y * div + dy) * w + (x * div + dx)) * 4
                    for c in range(4):
                        acc[c] += rgba[o + c]
            n = div * div
            o = (y * nw + x) * 4
            for c in range(4):
                out[o + c] = acc[c] // n
    return nw, nh, out


def build_atlas(textures):
    """Shelf-pack downscaled textures. Returns (W, H, rgba, placements[i]=(x, y, w, h))."""
    tiles = []
    for i, t in enumerate(textures):
        w, h, px = downscale(to_rgba(t), t.width, t.height, TEX_DIV)
        tiles.append((i, w, h, px))
    order = sorted(tiles, key=lambda e: -e[2])
    place = {}
    x = y = shelf_h = 0
    for i, w, h, _ in order:
        if x + w + 2 * PAD > ATLAS_W:
            x, y, shelf_h = 0, y + shelf_h, 0
        place[i] = (x + PAD, y + PAD, w, h)
        x += w + 2 * PAD
        shelf_h = max(shelf_h, h + 2 * PAD)
    height = y + shelf_h
    atlas = bytearray(ATLAS_W * height * 4)
    for i, w, h, px in tiles:
        ox, oy, _, _ = place[i]
        for yy in range(-PAD, h + PAD):
            sy = min(max(yy, 0), h - 1)
            for xx in range(-PAD, w + PAD):
                sx = min(max(xx, 0), w - 1)
                d = ((oy + yy) * ATLAS_W + (ox + xx)) * 4
                s = (sy * w + sx) * 4
                atlas[d:d + 4] = px[s:s + 4]
    return ATLAS_W, height, atlas, place


def convert(src, dst, report_path=None):
    with open(src, "rb") as f:
        m = mdl.parse(f.read())
    bones = m["bones"]
    nb = len(bones)

    # bind pose in GoldSrc space
    wpos, wrot = [], []
    for b in bones:
        q = mdl.angle_quaternion(b.value[3:])
        p = b.value[:3]
        if b.parent < 0:
            wpos.append(p)
            wrot.append(q)
        else:
            pr = wrot[b.parent]
            pp = wpos[b.parent]
            rp = quat_rot(pr, p)
            wpos.append((pp[0] + rp[0], pp[1] + rp[1], pp[2] + rp[2]))
            wrot.append(quat_mul(pr, q))

    # textures / atlas
    aw, ah, atlas, place = build_atlas(m["textures"])
    skinref = m["skinref"]

    # geometry (first submodel of every body part)
    positions, normals, uvs, joints, indices = [], [], [], [], []
    cache = {}
    stats = {"uv_out_of_range": 0, "uv_total": 0, "winding_ok": 0, "winding_total": 0}

    def vertex(model, vi, ni, s, t, tex_index):
        key = (id(model), vi, ni, s, t, tex_index)
        got = cache.get(key)
        if got is not None:
            return got
        bone = model["vbone"][vi]
        v = model["verts"][vi]
        wp = wpos[bone]
        r = quat_rot(wrot[bone], v)
        g = (wp[0] + r[0], wp[1] + r[1], wp[2] + r[2])
        positions.append(tuple(c * SCALE for c in mat_vec(M, g)))
        nbone = model["nbone"][ni]
        n = quat_rot(wrot[nbone], model["norms"][ni])
        normals.append(mat_vec(M, n))
        t_ = m["textures"][tex_index]
        u, w = s / t_.width, t / t_.height
        stats["uv_total"] += 1
        if u < 0 or u > 1 or w < 0 or w > 1:
            stats["uv_out_of_range"] += 1
        u = min(max(u, 0.0), 1.0)
        w = min(max(w, 0.0), 1.0)
        ox, oy, tw, th = place[tex_index]
        uvs.append(((ox + u * tw) / aw, (oy + w * th) / ah))
        joints.append(bone)
        idx = len(positions) - 1
        cache[key] = idx
        return idx

    for bp in m["bodyparts"]:
        model = bp["models"][0]
        for mesh in model["meshes"]:
            tex_index = skinref[mesh["skinref"]]
            for is_fan, vv in mesh["cmds"]:
                ids = [vertex(model, a, b, s, t, tex_index) for a, b, s, t in vv]
                tris = []
                if is_fan:
                    for i in range(1, len(ids) - 1):
                        tris.append((ids[0], ids[i + 1], ids[i]))
                else:
                    for i in range(len(ids) - 2):
                        if i % 2 == 0:
                            tris.append((ids[i], ids[i + 2], ids[i + 1]))
                        else:
                            tris.append((ids[i + 1], ids[i + 2], ids[i]))
                for a, b, c in tris:
                    if a == b or b == c or a == c:
                        continue
                    indices += (a, b, c)
                    pa, pb, pc = positions[a], positions[b], positions[c]
                    e1 = [pb[k] - pa[k] for k in range(3)]
                    e2 = [pc[k] - pa[k] for k in range(3)]
                    fn = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
                    vn = [sum(normals[i][k] for i in (a, b, c)) for k in range(3)]
                    stats["winding_total"] += 1
                    if fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] >= 0:
                        stats["winding_ok"] += 1

    # if most triangles disagree with the normals the winding is inverted: flip
    flipped = False
    if stats["winding_ok"] * 2 < stats["winding_total"]:
        flipped = True
        for i in range(0, len(indices), 3):
            indices[i + 1], indices[i + 2] = indices[i + 2], indices[i + 1]
        stats["winding_ok"] = stats["winding_total"] - stats["winding_ok"]

    # skeleton in glTF space (axis conversion on root bones only)
    def local_trs(i, pos, quat):
        if bones[i].parent < 0:
            return tuple(c * SCALE for c in mat_vec(M, pos)), quat_mul(QM, quat)
        return tuple(c * SCALE for c in pos), quat

    bind_t, bind_r = [], []
    for i, b in enumerate(bones):
        t, r = local_trs(i, b.value[:3], mdl.angle_quaternion(b.value[3:]))
        bind_t.append(t)
        bind_r.append(r)

    g = glb.GlbBuilder()
    npos = len(positions)
    pmin = [min(p[k] for p in positions) for k in range(3)]
    pmax = [max(p[k] for p in positions) for k in range(3)]
    a_pos = g.accessor(glb.FLOAT, npos, "VEC3", glb.floats(c for p in positions for c in p), 34962, [pmin, pmax])
    a_nrm = g.accessor(glb.FLOAT, npos, "VEC3", glb.floats(c for n in normals for c in n), 34962)
    a_uv = g.accessor(glb.FLOAT, npos, "VEC2", glb.floats(c for u in uvs for c in u), 34962)
    a_jnt = g.accessor(glb.UBYTE, npos, "VEC4", b"".join(struct.pack("<4B", j, 0, 0, 0) for j in joints), 34962)
    a_wgt = g.accessor(glb.FLOAT, npos, "VEC4", glb.floats(c for _ in joints for c in (1.0, 0.0, 0.0, 0.0)), 34962)
    big = npos > 65535
    a_idx = g.accessor(glb.UINT if big else glb.USHORT, len(indices), "SCALAR",
                       struct.pack("<%d%s" % (len(indices), "I" if big else "H"), *indices), 34963)

    # inverse bind matrices (column-major) from converted world bind transforms
    cwp, cwr = [], []
    for i, b in enumerate(bones):
        if b.parent < 0:
            cwp.append(bind_t[i])
            cwr.append(bind_r[i])
        else:
            pr, pp = cwr[b.parent], cwp[b.parent]
            rp = quat_rot(pr, bind_t[i])
            cwp.append((pp[0] + rp[0], pp[1] + rp[1], pp[2] + rp[2]))
            cwr.append(quat_mul(pr, bind_r[i]))
    ibm = []
    for i in range(nb):
        qi = quat_conj(cwr[i])
        cols = [quat_rot(qi, (1, 0, 0)), quat_rot(qi, (0, 1, 0)), quat_rot(qi, (0, 0, 1))]
        tr = quat_rot(qi, cwp[i])
        ibm += [*cols[0], 0, *cols[1], 0, *cols[2], 0, -tr[0], -tr[1], -tr[2], 1]
    a_ibm = g.accessor(glb.FLOAT, nb, "MAT4", glb.floats(ibm))

    nodes = []
    children = {i: [] for i in range(nb)}
    for i, b in enumerate(bones):
        if b.parent >= 0:
            children[b.parent].append(i)
    # node rest pose = first frame of "idle" (the bind pose of this model lies sideways)
    rest = next((s for s in m["sequences"] if s.name == "idle" and s.channels), None)
    rest_frame = mdl.sample_sequence(m, rest, 0) if rest else None
    for i, b in enumerate(bones):
        if rest_frame:
            rt, rr = local_trs(i, rest_frame[i][0], rest_frame[i][1])
        else:
            rt, rr = bind_t[i], bind_r[i]
        nodes.append({"name": b.name, "translation": list(rt), "rotation": list(rr)})
    extra = {}
    for ai, a in enumerate(m["attachments"]):
        name = "muzzle" if ai == 0 else "eject"
        nodes.append({"name": name, "translation": [c * SCALE for c in a["origin"]]})
        children[a["bone"]].append(len(nodes) - 1)
        extra[name] = a["bone"]
    for i in range(nb):
        if children[i]:
            nodes[i]["children"] = children[i]
    mesh_node = len(nodes)
    nodes.append({"name": "g36c_mesh", "mesh": 0, "skin": 0})

    # image / material
    png = glb.png_rgba(aw, ah, bytes(atlas))
    img = g.image(png)
    d = g.doc
    d["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}]
    d["textures"] = [{"sampler": 0, "source": img}]
    d["materials"] = [{"name": "g36c_atlas", "pbrMetallicRoughness": {
        "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 1.0}}]
    d["meshes"] = [{"name": "g36c", "primitives": [{
        "attributes": {"POSITION": a_pos, "NORMAL": a_nrm, "TEXCOORD_0": a_uv, "JOINTS_0": a_jnt, "WEIGHTS_0": a_wgt},
        "indices": a_idx, "material": 0}]}]
    d["skins"] = [{"joints": list(range(nb)), "inverseBindMatrices": a_ibm, "skeleton": 0}]

    # animations
    animated_t = set()
    animated_r = set()
    for s in m["sequences"]:
        if s.channels:
            for bi, (_ao, offs) in enumerate(s.channels):
                if any(offs[0:3]):
                    animated_t.add(bi)
                if any(offs[3:6]):
                    animated_r.add(bi)
    anims = []
    recovered = []
    for s in m["sequences"]:
        if not s.channels:
            continue
        nf = s.numframes
        times = [f / s.fps for f in range(nf)]
        a_time = g.accessor(glb.FLOAT, nf, "SCALAR", glb.floats(times), None, [[times[0]], [times[-1]]])
        frames = [mdl.sample_sequence(m, s, f) for f in range(nf)]
        samplers, channels = [], []
        for bi in range(nb):
            if bi in animated_t:
                vals = []
                for f in range(nf):
                    t, _ = local_trs(bi, frames[f][bi][0], frames[f][bi][1])
                    vals += t
                acc = g.accessor(glb.FLOAT, nf, "VEC3", glb.floats(vals))
                samplers.append({"input": a_time, "output": acc, "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": bi, "path": "translation"}})
            if bi in animated_r:
                vals = []
                prev = None
                for f in range(nf):
                    _, q = local_trs(bi, frames[f][bi][0], frames[f][bi][1])
                    if prev is not None and sum(a * b for a, b in zip(prev, q)) < 0:
                        q = tuple(-c for c in q)
                    prev = q
                    vals += q
                acc = g.accessor(glb.FLOAT, nf, "VEC4", glb.floats(vals))
                samplers.append({"input": a_time, "output": acc, "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": bi, "path": "rotation"}})
        anims.append({"name": s.name, "samplers": samplers, "channels": channels})
        recovered.append({"name": s.name, "frames": nf, "fps": round(s.fps, 3), "duration_s": round(nf / s.fps, 3)})
    d["animations"] = anims

    scene_nodes = [i for i, b in enumerate(bones) if b.parent < 0] + [mesh_node]
    d["nodes"] = nodes
    d["scenes"] = [{"nodes": scene_nodes}]
    d["scene"] = 0

    blob = g.finish()
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(blob)

    report = {
        "source": os.path.basename(src),
        "header_name": m["name"],
        "bones": nb,
        "bodyparts": [bp["name"] + ":" + bp["models"][0]["name"] for bp in m["bodyparts"]],
        "textures": len(m["textures"]),
        "atlas": [aw, ah],
        "vertices": npos,
        "triangles": len(indices) // 3,
        "draw_calls": 1,
        "bind_pose_bounds_m": {"min": [round(c, 4) for c in pmin], "max": [round(c, 4) for c in pmax]},
        "clips": recovered,
        "attachments": extra,
        "uv_out_of_range_pct": round(100.0 * stats["uv_out_of_range"] / max(1, stats["uv_total"]), 2),
        "winding_agreement_pct": round(100.0 * stats["winding_ok"] / max(1, stats["winding_total"]), 2),
        "winding_flipped": flipped,
        "glb_bytes": len(blob),
    }
    if report_path:
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
            f.write("\n")
    return report


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("usage: convert.py <input.mdl> <output.glb> [report.json]")
    try:
        print(json.dumps(convert(*sys.argv[1:4]), indent=2))
    except mdl.MdlError as e:
        sys.exit("conversion failed: %s" % e)
