"""Minimal GLB (glTF 2.0 binary) writer plus a tiny PNG encoder. Standard library only."""
import json
import struct
import zlib

FLOAT, UBYTE, USHORT, UINT = 5126, 5121, 5123, 5125


def png_rgba(width, height, rgba):
    """Encode RGBA bytes (len = w*h*4) as PNG."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(tag, body):
        c = struct.pack(">I", len(body)) + tag + body
        return c + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


class GlbBuilder:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        self.doc = {"asset": {"version": "2.0", "generator": "nuclear-harbor mdl2glb"}}

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.bin += data
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, comp, count, atype, data, target=None, minmax=None, normalized=False):
        a = {"bufferView": self._view(data, target), "componentType": comp, "count": count, "type": atype}
        if minmax:
            a["min"], a["max"] = minmax
        if normalized:
            a["normalized"] = True
        self.accessors.append(a)
        return len(self.accessors) - 1

    def image(self, png_bytes):
        vi = self._view(png_bytes)
        self.doc.setdefault("images", []).append({"bufferView": vi, "mimeType": "image/png"})
        return len(self.doc["images"]) - 1

    def finish(self):
        d = self.doc
        d["buffers"] = [{"byteLength": len(self.bin)}]
        d["bufferViews"] = self.views
        d["accessors"] = self.accessors
        js = json.dumps(d, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        b = bytes(self.bin)
        while len(b) % 4:
            b += b"\0"
        total = 12 + 8 + len(js) + 8 + len(b)
        return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
                + struct.pack("<II", len(b), 0x004E4942) + b)


def floats(seq):
    seq = list(seq)
    return struct.pack("<%df" % len(seq), *seq)
