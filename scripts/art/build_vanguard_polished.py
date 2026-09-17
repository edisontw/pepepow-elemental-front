"""Generate a polished, reproducible Vanguard GLB for Elemental Front.

The asset remains a browser-friendly rigid-node fallback, but now embeds the
canonical U0/U1 animation vocabulary (Idle, Move, Attack, Hit, Death) so the
runtime controller can prove the clip pipeline before a final skinned Vanguard
is manually approved. Standard-library only; no external model dependency.
"""
import json, math, struct
from pathlib import Path
from production_asset_guard import may_generate_fallback

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models/unit-vanguard.glb'

MATERIALS = {
    'STEEL':  {'color': (.23, .27, .31, 1), 'metallic': .82, 'roughness': .30},
    'EDGE':   {'color': (.53, .57, .60, 1), 'metallic': .90, 'roughness': .22},
    'DARK':   {'color': (.055, .065, .075, 1), 'metallic': .45, 'roughness': .48},
    'LEATHER':{'color': (.18, .095, .045, 1), 'metallic': .05, 'roughness': .78},
    'CLOTH':  {'color': (.065, .12, .085, 1), 'metallic': .0,  'roughness': .92},
    'BRASS':  {'color': (.58, .37, .13, 1), 'metallic': .84, 'roughness': .30},
    'TEAM':   {'color': (.08, .55, .45, 1), 'metallic': .10, 'roughness': .62},
}


def quat_xyz(rx=0.0, ry=0.0, rz=0.0):
    """Quaternion for intrinsic XYZ degrees, stored glTF x/y/z/w."""
    x = math.radians(rx) * .5
    y = math.radians(ry) * .5
    z = math.radians(rz) * .5
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return (
        sx * cy * cz - cx * sy * sz,
        cx * sy * cz + sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    )


class Model:
    def __init__(self):
        self.groups = {}
        self.pivots = {}

    def face(self, name, material, points):
        pos, norms = self.groups.setdefault((name, material), [[], []])
        a, b, c = points[:3]
        u = [b[i] - a[i] for i in range(3)]
        v = [c[i] - a[i] for i in range(3)]
        n = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ]
        length = math.sqrt(sum(x * x for x in n)) or 1
        n = [x / length for x in n]
        for i in range(1, len(points) - 1):
            for p in (points[0], points[i], points[i + 1]):
                pos.extend(p)
                norms.extend(n)

    def box(self, pos, size, material='STEEL', name='Body'):
        x, y, z = pos
        a, b, c = [s / 2 for s in size]
        p = [
            (x + i * a, y + j * b, z + k * c)
            for i, j, k in [
                (-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1),
            ]
        ]
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)]:
            self.face(name, material, [p[i] for i in f])

    def lathe(self, pos, rings, material='STEEL', sides=10, name='Body', depth=1.0):
        x, y, z = pos
        rows = [
            [
                (x + r * math.sin(i * 2 * math.pi / sides), y + h, z + r * math.cos(i * 2 * math.pi / sides) * depth)
                for i in range(sides)
            ]
            for h, r in rings
        ]
        self.face(name, material, list(reversed(rows[0])))
        for lo, hi in zip(rows, rows[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                self.face(name, material, [lo[i], lo[j], hi[j], hi[i]])
        self.face(name, material, rows[-1])

    def wedge(self, pos, size, material='STEEL', name='Body', front_taper=.55):
        x, y, z = pos
        sx, sy, sz = size
        a, b, c = sx / 2, sy / 2, sz / 2
        t = a * front_taper
        p = [
            (x - a, y - b, z - c), (x + a, y - b, z - c), (x + t, y + b, z - c), (x - t, y + b, z - c),
            (x - a, y - b, z + c), (x + a, y - b, z + c), (x + t, y + b, z + c), (x - t, y + b, z + c),
        ]
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)]:
            self.face(name, material, [p[i] for i in f])

    def ring(self, pos, radius, tube, material='BRASS', name='Body', vertical=False, segments=20):
        x, y, z = pos

        def p(i, j):
            a = i * 2 * math.pi / segments
            b = j * 2 * math.pi / 6
            q = (
                (radius + tube * math.cos(b)) * math.cos(a),
                tube * math.sin(b),
                (radius + tube * math.cos(b)) * math.sin(a),
            )
            return (x + q[0], y + (q[2] if vertical else q[1]), z + (q[1] if vertical else q[2]))

        for i in range(segments):
            for j in range(6):
                pts = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]
                self.face(name, material, pts if vertical else list(reversed(pts)))

    def export(self, path):
        if not may_generate_fallback(path):
            return
        data = bytearray()
        views = []
        accessors = []
        meshes = []
        nodes = []
        material_names = list(MATERIALS)
        mats = []
        for name in material_names:
            spec = MATERIALS[name]
            mats.append({
                'name': name,
                'pbrMetallicRoughness': {
                    'baseColorFactor': list(spec['color']),
                    'metallicFactor': spec['metallic'],
                    'roughnessFactor': spec['roughness'],
                },
            })

        def accessor(vals, components, gltf_type, bounds=False):
            offset = len(data)
            data.extend(struct.pack('<' + 'f' * len(vals), *vals))
            views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(vals) * 4})
            item = {
                'bufferView': len(views) - 1,
                'componentType': 5126,
                'count': len(vals) // components,
                'type': gltf_type,
            }
            if bounds:
                item['min'] = [min(vals[i::components]) for i in range(components)]
                item['max'] = [max(vals[i::components]) for i in range(components)]
            accessors.append(item)
            return len(accessors) - 1

        node_mesh = {}
        for (name, mat), arrays in self.groups.items():
            prim = {
                'attributes': {
                    'POSITION': accessor(arrays[0], 3, 'VEC3', True),
                    'NORMAL': accessor(arrays[1], 3, 'VEC3', False),
                },
                'material': material_names.index(mat),
            }
            if name in node_mesh:
                meshes[node_mesh[name]]['primitives'].append(prim)
            else:
                idx = len(meshes)
                node_mesh[name] = idx
                meshes.append({'name': name, 'primitives': [prim]})
                nodes.append({'name': name, 'mesh': idx, 'translation': self.pivots.get(name, [0, 0, 0])})

        node_index = {node['name']: index for index, node in enumerate(nodes)}
        weapon_tip_index = len(nodes)
        nodes.append({'name': 'WeaponTip', 'translation': [0, -.09, 1.42]})
        if 'Weapon' in node_index:
            nodes[node_index['Weapon']]['children'] = [weapon_tip_index]

        model_root_index = len(nodes)
        top_level_children = [index for index in range(len(nodes)) if index != weapon_tip_index]
        nodes.append({'name': 'ModelRoot', 'children': top_level_children})
        node_index['ModelRoot'] = model_root_index

        animations = []

        def add_rotation_animation(name, specs):
            samplers = []
            channels = []
            for node_name, keys in specs:
                times = [t for t, _ in keys]
                rotations = []
                for _, euler in keys:
                    rotations.extend(quat_xyz(*euler))
                input_accessor = accessor(times, 1, 'SCALAR', True)
                output_accessor = accessor(rotations, 4, 'VEC4', False)
                sampler_index = len(samplers)
                samplers.append({
                    'input': input_accessor,
                    'output': output_accessor,
                    'interpolation': 'LINEAR',
                })
                channels.append({
                    'sampler': sampler_index,
                    'target': {'node': node_index[node_name], 'path': 'rotation'},
                })
            animations.append({'name': name, 'samplers': samplers, 'channels': channels})

        add_rotation_animation('Idle', [
            ('Weapon', [(0.0, (0, 0, 0)), (1.0, (2.5, 0, -1.5)), (2.0, (0, 0, 0))]),
        ])
        add_rotation_animation('Move', [
            ('LegL', [(0.0, (24, 0, 0)), (.30, (-24, 0, 0)), (.60, (24, 0, 0))]),
            ('LegR', [(0.0, (-24, 0, 0)), (.30, (24, 0, 0)), (.60, (-24, 0, 0))]),
            ('Weapon', [(0.0, (-6, 0, -2)), (.30, (5, 0, 2)), (.60, (-6, 0, -2))]),
        ])
        add_rotation_animation('Attack', [
            ('Weapon', [
                (0.0, (8, 0, 0)),
                (.16, (22, 0, -8)),
                (.38, (-72, 0, 7)),
                (.62, (-18, 0, 2)),
                (.92, (0, 0, 0)),
            ]),
            ('ModelRoot', [
                (0.0, (0, 0, 0)),
                (.18, (0, -4, 0)),
                (.40, (0, 6, 0)),
                (.92, (0, 0, 0)),
            ]),
        ])
        add_rotation_animation('Hit', [
            ('ModelRoot', [(0.0, (0, 0, 0)), (.08, (0, 0, -8)), (.24, (0, 0, 0))]),
            ('Weapon', [(0.0, (0, 0, 0)), (.08, (12, 0, 5)), (.24, (0, 0, 0))]),
        ])
        add_rotation_animation('Death', [
            ('ModelRoot', [(0.0, (0, 0, 0)), (.30, (0, 0, 16)), (.92, (0, 0, 76))]),
            ('Weapon', [(0.0, (0, 0, 0)), (.40, (-28, 0, -12)), (.92, (-38, 0, -18))]),
        ])

        gltf = {
            'asset': {'version': '2.0', 'generator': 'Elemental Front Vanguard polished animated prototype'},
            'scene': 0,
            'scenes': [{'nodes': [model_root_index]}],
            'nodes': nodes,
            'meshes': meshes,
            'materials': mats,
            'animations': animations,
            'buffers': [{'byteLength': len(data)}],
            'bufferViews': views,
            'accessors': accessors,
        }
        enc = json.dumps(gltf, separators=(',', ':')).encode()
        enc += b' ' * ((-len(enc)) % 4)
        data += b'\0' * ((-len(data)) % 4)
        blob = (
            struct.pack('<III', 0x46546c67, 2, 28 + len(enc) + len(data))
            + struct.pack('<II', len(enc), 0x4e4f534a)
            + enc
            + struct.pack('<II', len(data), 0x004e4942)
            + data
        )
        path.write_bytes(blob)
        tris = sum(len(g[0]) // 9 for g in self.groups.values())
        print(f'{path.name}: {len(blob)//1024} KiB, {tris} triangles, {len(self.groups)} primitives, {len(animations)} clips')


m = Model()
for sign, name in [(-1, 'LegL'), (1, 'LegR')]:
    m.pivots[name] = [sign * .205, .72, 0]
    m.box((0, -.10, 0), (.24, .34, .24), 'CLOTH', name)
    m.lathe((0, -.35, 0), [(-.16, .155), (-.02, .18), (.12, .15)], 'STEEL', 10, name, .78)
    m.lathe((0, -.24, .13), [(-.07, .18), (0, .205), (.08, .15)], 'EDGE', 8, name, .62)
    m.box((0, -.56, .07), (.31, .16, .42), 'DARK', name)
    m.box((0, -.57, .17), (.29, .08, .24), 'STEEL', name)
    m.box((0, -.42, .14), (.25, .035, .12), 'BRASS', name)

m.lathe((0, 0, 0), [(.69, .28), (.82, .34), (1.08, .40), (1.30, .37), (1.38, .29)], 'DARK', 12, depth=.66)
m.wedge((0, 1.08, .08), (.72, .48, .34), 'STEEL', 'Body', .72)
m.box((0, 1.21, .265), (.54, .055, .035), 'EDGE')
m.box((0, 1.04, .275), (.49, .05, .035), 'BRASS')
m.box((0, .84, .02), (.68, .11, .40), 'LEATHER')
m.box((0, .83, .25), (.16, .16, .07), 'BRASS')
m.box((-.30, .82, .19), (.18, .21, .15), 'LEATHER')
m.box((.32, .82, .18), (.18, .18, .14), 'LEATHER')
m.wedge((0, .62, .24), (.34, .58, .055), 'TEAM', 'Body', .45)
m.box((0, .79, .272), (.30, .035, .018), 'BRASS')
m.wedge((0, .62, -.22), (.31, .52, .045), 'TEAM', 'Body', .45)
m.lathe((0, 0, 0), [(1.36, .23), (1.43, .25), (1.50, .21)], 'BRASS', 10, depth=.82)
m.lathe((0, 0, 0), [(1.44, .215), (1.66, .255), (1.78, .14)], 'STEEL', 12, depth=.88)
m.box((0, 1.59, .225), (.34, .07, .035), 'DARK')
for x in (-.12, -.06, 0, .06, .12):
    m.box((x, 1.585, .247), (.025, .11, .018), 'DARK')
m.wedge((0, 1.84, -.03), (.12, .30, .28), 'TEAM', 'Body', .30)
for sign in (-1, 1):
    m.lathe((sign * .43, 1.30, 0), [(-.12, .18), (.02, .27), (.14, .16)], 'EDGE', 10, depth=.82)
    m.lathe((sign * .43, 1.30, .01), [(-.10, .155), (.02, .235), (.11, .135)], 'BRASS', 10, depth=.82)
    m.box((sign * .45, 1.05, 0), (.22, .34, .24), 'DARK')
    m.box((sign * .45, .94, .05), (.24, .16, .27), 'STEEL')
m.box((0, 1.08, -.30), (.50, .55, .22), 'LEATHER')
m.box((0, 1.08, -.425), (.43, .05, .08), 'BRASS')
for x in (-.16, .16):
    m.box((x, 1.08, -.43), (.035, .46, .05), 'BRASS')

x = -.55
y = 1.04
for width, height, front, mat in [(.76, .90, .42, 'EDGE'), (.67, .80, .445, 'DARK'), (.59, .71, .466, 'TEAM')]:
    w = width / 2
    pts = [
        (x - w, y - .28, front),
        (x, y - height / 2, front),
        (x + w, y - .28, front),
        (x + w, y + height / 2, front),
        (x - w, y + height / 2, front),
    ]
    m.face('Body', mat, pts)
m.box((x, y + .03, .492), (.075, .73, .035), 'BRASS')
m.box((x, y + .08, .492), (.52, .065, .035), 'BRASS')
m.lathe((x, y + .09, .505), [(-.035, .10), (.035, .10)], 'BRASS', 10, depth=.35)

m.pivots['Weapon'] = [.48, 1.04, .04]
m.box((0, -.12, .04), (.15, .25, .16), 'LEATHER', 'Weapon')
m.box((0, -.08, .30), (.38, .075, .075), 'BRASS', 'Weapon')
m.lathe((0, -.26, .03), [(-.055, .08), (.055, .08)], 'BRASS', 8, 'Weapon', .75)
blade = [(-.055, -.09, .32), (.055, -.09, .32), (.045, -.09, 1.22), (0, -.09, 1.42), (-.045, -.09, 1.22)]
blade2 = [(a, b + .07, c) for a, b, c in blade]
m.face('Weapon', 'EDGE', blade)
m.face('Weapon', 'EDGE', list(reversed(blade2)))
for i in range(len(blade)):
    j = (i + 1) % len(blade)
    m.face('Weapon', 'STEEL', [blade[i], blade[j], blade2[j], blade2[i]])
for sx in (-.25, .25):
    for sy in (.98, 1.20):
        m.lathe((sx, sy, .285), [(-.018, .025), (.018, .025)], 'BRASS', 8, depth=.35)

m.export(OUT)
