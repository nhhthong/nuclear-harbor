"""Pure-Python GoldSrc MDL v10 (IDST) reader. Standard library only.

The input is untrusted: every offset and count is bounds-checked, and failures raise MdlError.
Run with `python3 -I` so nothing is imported from the current directory.
"""
import math
import struct


class MdlError(Exception):
    pass


class Reader:
    def __init__(self, data):
        self.d = data

    def unpack(self, fmt, off):
        size = struct.calcsize(fmt)
        if off < 0 or off + size > len(self.d):
            raise MdlError("read out of range at %d (+%d)" % (off, size))
        return struct.unpack_from(fmt, self.d, off)

    def cstr(self, off, n):
        if off < 0 or off + n > len(self.d):
            raise MdlError("string out of range")
        return self.d[off:off + n].split(b"\0")[0].decode("latin-1")

    def check(self, off, size):
        if off < 0 or size < 0 or off + size > len(self.d):
            raise MdlError("range out of file: %d+%d" % (off, size))


def angle_quaternion(a):
    """GoldSrc euler (roll X, pitch Y, yaw Z) to quaternion (x, y, z, w)."""
    sr, cr = math.sin(a[0] * 0.5), math.cos(a[0] * 0.5)
    sp, cp = math.sin(a[1] * 0.5), math.cos(a[1] * 0.5)
    sy, cy = math.sin(a[2] * 0.5), math.cos(a[2] * 0.5)
    return (
        sr * cp * cy - cr * sp * sy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
        cr * cp * cy + sr * sp * sy,
    )


class Bone:
    pass


class Texture:
    pass


class Sequence:
    pass


def parse(data):
    r = Reader(data)
    if data[:4] != b"IDST":
        raise MdlError("not an IDST model")
    (version,) = r.unpack("<i", 4)
    if version != 10:
        raise MdlError("unsupported MDL version %d" % version)
    names = ("flags numbones boneindex numbonecontrollers bonecontrollerindex numhitboxes hitboxindex "
             "numseq seqindex numseqgroups seqgroupindex numtextures textureindex texturedataindex "
             "numskinref numskinfamilies skinindex numbodyparts bodypartindex numattachments "
             "attachmentindex").split()
    vals = r.unpack("<%di" % len(names), 136)
    h = dict(zip(names, vals))
    if h["numbones"] > 256 or h["numseq"] > 256 or h["numtextures"] > 256 or h["numbodyparts"] > 64:
        raise MdlError("implausible counts")
    m = {"header": h, "name": r.cstr(8, 64)}

    # bones: name32, parent, flags, controllers[6], value[6], scale[6]
    bones = []
    for i in range(h["numbones"]):
        o = h["boneindex"] + i * 112
        b = Bone()
        b.name = r.cstr(o, 32)
        (b.parent,) = r.unpack("<i", o + 32)
        if b.parent < -1 or b.parent >= i:
            raise MdlError("bone %d has invalid parent %d" % (i, b.parent))
        vals = r.unpack("<12f", o + 64)
        b.value = vals[:6]
        b.scale = vals[6:]
        bones.append(b)
    m["bones"] = bones

    # textures: name64, flags, w, h, index
    tex = []
    for i in range(h["numtextures"]):
        o = h["textureindex"] + i * 80
        t = Texture()
        t.name = r.cstr(o, 64)
        t.flags, t.width, t.height, idx = r.unpack("<4i", o + 64)
        if not (0 < t.width <= 4096 and 0 < t.height <= 4096):
            raise MdlError("bad texture size")
        r.check(idx, t.width * t.height + 768)
        t.pixels = data[idx:idx + t.width * t.height]
        pal = data[idx + t.width * t.height:idx + t.width * t.height + 768]
        t.palette = [tuple(pal[j:j + 3]) for j in range(0, 768, 3)]
        tex.append(t)
    m["textures"] = tex

    nskin = h["numskinref"]
    m["skinref"] = list(r.unpack("<%dh" % nskin, h["skinindex"])) if nskin else []

    # bodyparts -> models -> meshes
    bodyparts = []
    for i in range(h["numbodyparts"]):
        o = h["bodypartindex"] + i * 76
        name = r.cstr(o, 64)
        nummodels, base, modelindex = r.unpack("<3i", o + 64)
        if nummodels > 64:
            raise MdlError("too many models")
        models = []
        for j in range(nummodels):
            mo = modelindex + j * 112
            mname = r.cstr(mo, 64)
            (_type, _rad, nummesh, meshindex, numverts, vertinfo, vertindex,
             numnorms, norminfo, normindex, _ng, _gi) = r.unpack("<ifiiiiiiiiii", mo + 64)
            if numverts > 65535 or numnorms > 65535 or nummesh > 256:
                raise MdlError("implausible model size")
            vbone = list(r.unpack("<%dB" % numverts, vertinfo)) if numverts else []
            nbone = list(r.unpack("<%dB" % numnorms, norminfo)) if numnorms else []
            verts = [r.unpack("<3f", vertindex + k * 12) for k in range(numverts)]
            norms = [r.unpack("<3f", normindex + k * 12) for k in range(numnorms)]
            meshes = []
            for k in range(nummesh):
                eo = meshindex + k * 20
                numtris, triindex, skinref, _nn, _ni = r.unpack("<5i", eo)
                cmds = []
                p = triindex
                while True:
                    (n,) = r.unpack("<h", p)
                    p += 2
                    if n == 0:
                        break
                    cnt = abs(n)
                    vv = [r.unpack("<4h", p + q * 8) for q in range(cnt)]
                    p += cnt * 8
                    cmds.append((n < 0, vv))  # (is_fan, [(vert, norm, s, t)])
                meshes.append({"skinref": skinref, "cmds": cmds, "numtris": numtris})
            models.append({"name": mname, "verts": verts, "vbone": vbone, "norms": norms,
                           "nbone": nbone, "meshes": meshes})
        bodyparts.append({"name": name, "models": models})
    m["bodyparts"] = bodyparts

    # attachments: name32, type, bone, origin[3], vectors[9]
    att = []
    for i in range(h["numattachments"]):
        o = h["attachmentindex"] + i * 88
        name = r.cstr(o, 32)
        _type, bone = r.unpack("<2i", o + 32)
        origin = r.unpack("<3f", o + 40)
        att.append({"name": name, "bone": bone, "origin": origin})
    m["attachments"] = att

    # sequences (embedded group 0 only)
    seqs = []
    nb = len(bones)
    for i in range(h["numseq"]):
        o = h["seqindex"] + i * 176
        s = Sequence()
        s.name = r.cstr(o, 32)
        s.fps, s.flags, s.activity, _aw, s.numevents, _ei, s.numframes = r.unpack("<fiiiiii", o + 32)
        (numblends, animindex) = r.unpack("<2i", o + 120)
        (s.seqgroup,) = r.unpack("<i", o + 156)
        s.numblends = numblends
        s.animindex = animindex
        s.channels = None
        if s.seqgroup == 0 and 0 < s.numframes <= 2000 and numblends >= 1:
            ch = []
            for b in range(nb):
                ao = animindex + b * 12  # first blend only
                offs = r.unpack("<6H", ao)
                ch.append((ao, offs))
            s.channels = ch
        seqs.append(s)
    m["sequences"] = seqs
    m["_reader"] = r
    return m


def _channel_value(r, base, offset, frame):
    """Decode one RLE animation channel at `frame` (raw int16 value)."""
    p = base + offset
    k = frame
    guard = 0
    while True:
        valid, total = r.unpack("<2B", p)
        if total == 0:
            raise MdlError("zero-length RLE run")
        if total > k:
            break
        k -= total
        p += (valid + 1) * 2
        guard += 1
        if guard > 4096:
            raise MdlError("RLE runaway")
    if valid > k:
        return r.unpack("<h", p + 2 + k * 2)[0]
    return r.unpack("<h", p + 2 + (valid - 1) * 2)[0]


def sample_sequence(m, seq, frame):
    """Return per-bone (pos(3), quat(4)) in GoldSrc space for a sequence frame."""
    r = m["_reader"]
    out = []
    for bi, bone in enumerate(m["bones"]):
        ao, offs = seq.channels[bi]
        vals = []
        for c in range(6):
            v = bone.value[c]
            if offs[c]:
                raw = _channel_value(r, ao, offs[c], frame)
                v += raw * bone.scale[c]
            vals.append(v)
        out.append((tuple(vals[:3]), angle_quaternion(vals[3:])))
    return out
