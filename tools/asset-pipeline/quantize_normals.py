"""
Shrink a GLB by storing vertex normals as normalized int8 (KHR_mesh_quantization, read natively by three's
GLTFLoader). Positions, UVs, indices and images are copied unchanged.

    python3 tools/asset-pipeline/quantize_normals.py <in.glb> <out.glb>
"""
import json
import struct
import sys

import numpy as np

src, dst = sys.argv[1], sys.argv[2]
data = open(src, 'rb').read()
jlen = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + jlen])
boff = 20 + jlen
blen = struct.unpack_from('<I', data, boff)[0]
binary = data[boff + 8:boff + 8 + blen]

views = gltf['bufferViews']
accessors = gltf['accessors']
normal_accessors = {p['attributes']['NORMAL'] for m in gltf['meshes'] for p in m['primitives'] if 'NORMAL' in p['attributes']}

# new payload per bufferView (index -> bytes); normals get fresh views
chunks = [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
new_views = [dict(v) for v in views]
for ai in sorted(normal_accessors):
    a = accessors[ai]
    v = views[a['bufferView']]
    assert a['componentType'] == 5126 and a['type'] == 'VEC3' and 'byteStride' not in v, 'tightly packed float normals only'
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = np.frombuffer(binary, dtype='<f4', count=a['count'] * 3, offset=start).reshape(-1, 3)
    q = np.zeros((a['count'], 4), dtype=np.int8)
    q[:, :3] = np.clip(np.round(n * 127.0), -127, 127)
    chunks.append(q.tobytes())
    new_views.append({'buffer': 0, 'byteLength': q.nbytes, 'byteStride': 4, 'target': 34962})
    a['bufferView'] = len(new_views) - 1
    a['byteOffset'] = 0
    a['componentType'] = 5120
    a['normalized'] = True
    a.pop('min', None)
    a.pop('max', None)

# drop views nothing references any more, then repack the buffer (4-byte aligned)
used = {a['bufferView'] for a in accessors if 'bufferView' in a} | {im['bufferView'] for im in gltf.get('images', []) if 'bufferView' in im}
remap, out_views, blob = {}, [], bytearray()
for i, (v, c) in enumerate(zip(new_views, chunks)):
    if i not in used:
        continue
    while len(blob) % 4:
        blob += b'\0'
    v = dict(v)
    v['byteOffset'] = len(blob)
    v['byteLength'] = len(c)
    blob += c
    remap[i] = len(out_views)
    out_views.append(v)
while len(blob) % 4:
    blob += b'\0'
for a in accessors:
    if 'bufferView' in a:
        a['bufferView'] = remap[a['bufferView']]
for im in gltf.get('images', []):
    if 'bufferView' in im:
        im['bufferView'] = remap[im['bufferView']]
gltf['bufferViews'] = out_views
gltf['buffers'] = [{'byteLength': len(blob)}]
for key in ('extensionsUsed', 'extensionsRequired'):
    gltf[key] = sorted(set(gltf.get(key, [])) | {'KHR_mesh_quantization'})

js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
total = 12 + 8 + len(js) + 8 + len(blob)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
    f.write(struct.pack('<II', len(blob), 0x004E4942) + bytes(blob))
print(f'{src}: {len(data)} -> {dst}: {total} bytes ({len(normal_accessors)} normal accessors quantized)')
