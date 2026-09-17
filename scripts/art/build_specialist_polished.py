"""Generate polished specialist GLBs for Elemental Front.

Outputs:
- unit-spear-guard.glb
- unit-ranger.glb
- unit-engineer.glb

All models preserve existing rigid runtime animation nodes:
- LegL
- LegR
- Weapon
"""
import json, math, struct
from pathlib import Path
from production_asset_guard import may_generate_fallback

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models'

MATERIALS = {
    'STEEL':  {'color': (.23, .27, .31, 1), 'metallic': .82, 'roughness': .30},
    'EDGE':   {'color': (.54, .58, .62, 1), 'metallic': .90, 'roughness': .20},
    'DARK':   {'color': (.06, .07, .08, 1), 'metallic': .40, 'roughness': .44},
    'LEATHER':{'color': (.18, .10, .05, 1), 'metallic': .05, 'roughness': .80},
    'CLOTH':  {'color': (.06, .12, .09, 1), 'metallic': .0,  'roughness': .94},
    'BRASS':  {'color': (.58, .37, .13, 1), 'metallic': .82, 'roughness': .32},
    'WOOD':   {'color': (.33, .22, .11, 1), 'metallic': .0,  'roughness': .90},
    'TEAM':   {'color': (.08, .55, .45, 1), 'metallic': .10, 'roughness': .60},
}

class Model:
    def __init__(self, generator_name: str):
        self.groups = {}
        self.pivots = {}
        self.generator_name = generator_name

    def face(self, name, material, points):
        pos, norms = self.groups.setdefault((name, material), [[], []])
        a, b, c = points[:3]
        u = [b[i] - a[i] for i in range(3)]
        v = [c[i] - a[i] for i in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        L = math.sqrt(sum(x*x for x in n)) or 1
        n = [x / L for x in n]
        for i in range(1, len(points) - 1):
            for p in (points[0], points[i], points[i+1]):
                pos.extend(p)
                norms.extend(n)

    def box(self, pos, size, material='STEEL', name='Body'):
        x, y, z = pos; a, b, c = [s/2 for s in size]
        p = [(x+i*a, y+j*b, z+k*c) for i, j, k in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for f in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
            self.face(name, material, [p[i] for i in f])

    def wedge(self, pos, size, material='STEEL', name='Body', front_taper=.55, z_skew=0):
        x, y, z = pos; sx, sy, sz = size; a=sx/2; b=sy/2; c=sz/2; t=a*front_taper
        p=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+t,y+b,z-c+z_skew),(x-t,y+b,z-c+z_skew),
           (x-a,y-b,z+c),(x+a,y-b,z+c),(x+t,y+b,z+c+z_skew),(x-t,y+b,z+c+z_skew)]
        for f in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
            self.face(name, material, [p[i] for i in f])

    def lathe(self, pos, rings, material='STEEL', sides=10, name='Body', depth=1.0):
        x, y, z = pos
        rows = [[(x+r*math.sin(i*2*math.pi/sides), y+h, z+r*math.cos(i*2*math.pi/sides)*depth) for i in range(sides)] for h, r in rings]
        self.face(name, material, list(reversed(rows[0])))
        for lo, hi in zip(rows, rows[1:]):
            for i in range(sides):
                j = (i+1) % sides
                self.face(name, material, [lo[i], lo[j], hi[j], hi[i]])
        self.face(name, material, rows[-1])

    def ring(self, pos, radius, tube, material='BRASS', name='Body', vertical=False, segments=20, sides=6):
        x, y, z = pos
        def p(i, j):
            a = i * 2 * math.pi / segments
            b = j * 2 * math.pi / sides
            q = ((radius+tube*math.cos(b))*math.cos(a), tube*math.sin(b), (radius+tube*math.cos(b))*math.sin(a))
            return (x+q[0], y+(q[2] if vertical else q[1]), z+(q[1] if vertical else q[2]))
        for i in range(segments):
            for j in range(sides):
                pts=[p(i,j), p(i+1,j), p(i+1,j+1), p(i,j+1)]
                self.face(name, material, pts if vertical else list(reversed(pts)))

    def prism_path(self, points, thickness=0.06, material='STEEL', name='Weapon', axis='y'):
        if axis == 'y':
            other = [(x, y+thickness, z) for x, y, z in points]
        elif axis == 'x':
            other = [(x+thickness, y, z) for x, y, z in points]
        else:
            other = [(x, y, z+thickness) for x, y, z in points]
        self.face(name, material, points)
        self.face(name, material, list(reversed(other)))
        for i in range(len(points)):
            j = (i+1) % len(points)
            self.face(name, material, [points[i], points[j], other[j], other[i]])

    def export(self, out_path: Path):
        if not may_generate_fallback(out_path):
            return
        data = bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        material_names = list(MATERIALS)
        mats=[]
        for name in material_names:
            spec=MATERIALS[name]
            mats.append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':list(spec['color']),'metallicFactor':spec['metallic'],'roughnessFactor':spec['roughness']}})
        def accessor(vals):
            offset=len(data)
            data.extend(struct.pack('<'+'f'*len(vals), *vals))
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(vals)*4})
            accessors.append({'bufferView':len(views)-1,'componentType':5126,'count':len(vals)//3,'type':'VEC3','min':[min(vals[i::3]) for i in range(3)],'max':[max(vals[i::3]) for i in range(3)]})
            return len(accessors)-1
        node_mesh={}
        for (name, mat), arrays in self.groups.items():
            primitive={'attributes':{'POSITION':accessor(arrays[0]),'NORMAL':accessor(arrays[1])},'material':material_names.index(mat)}
            if name in node_mesh:
                meshes[node_mesh[name]]['primitives'].append(primitive)
            else:
                idx=len(meshes)
                node_mesh[name]=idx
                meshes.append({'name':name,'primitives':[primitive]})
                nodes.append({'name':name,'mesh':idx,'translation':self.pivots.get(name,[0,0,0])})
        gltf={'asset':{'version':'2.0','generator':self.generator_name},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':mats,'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors}
        enc=json.dumps(gltf,separators=(',',':')).encode(); enc += b' ' * ((-len(enc)) % 4)
        data += b'\0' * ((-len(data)) % 4)
        blob=struct.pack('<III',0x46546c67,2,28+len(enc)+len(data))+struct.pack('<II',len(enc),0x4e4f534a)+enc+struct.pack('<II',len(data),0x004e4942)+data
        out_path.write_bytes(blob)
        tris=sum(len(g[0])//9 for g in self.groups.values())
        print(f'{out_path.name}: {len(blob)//1024} KiB, {tris} triangles, {len(self.groups)} primitives')


def common_legs(m: Model, hip_x: float = 0.18, y0: float = 0.62, armored=True):
    for sign, name in [(-1, 'LegL'), (1, 'LegR')]:
        m.pivots[name] = [sign*hip_x, y0, 0]
        m.box((0, -.10, 0), (.23, .32, .22), 'CLOTH', name)
        m.lathe((0, -.37, 0), [(-.14, .14), (.00, .16), (.13, .14)], 'STEEL' if armored else 'DARK', 10, name, .78)
        if armored:
            m.box((0, -.26, .12), (.18, .12, .08), 'EDGE', name)
        m.box((0, -.56, .08), (.30, .16, .40), 'DARK' if armored else 'LEATHER', name)
        m.box((0, -.56, .18), (.26, .07, .20), 'STEEL' if armored else 'LEATHER', name)


def build_spear_guard():
    m = Model('Elemental Front Spear Guard polished prototype')
    common_legs(m, hip_x=.19, y0=.66, armored=True)
    m.lathe((0,0,0),[(.64,.27),(.82,.31),(1.12,.30)],'DARK',10,depth=.67)
    m.wedge((0,1.00,.06),(.64,.46,.30),'STEEL','Body',.72)
    m.box((0,.83,.02),(.64,.10,.38),'LEATHER')
    m.box((0,1.10,.24),(.48,.05,.03),'EDGE')
    m.box((0,1.00,.25),(.42,.05,.03),'BRASS')
    m.wedge((0,.60,.22),(.26,.56,.05),'TEAM','Body',.42)
    m.wedge((0,.60,-.20),(.24,.46,.04),'TEAM','Body',.42)
    m.lathe((0,0,0),[(1.18,.20),(1.40,.24),(1.54,.13)],'STEEL',10,depth=.86)
    m.box((0,1.32,.22),(.28,.06,.03),'DARK')
    m.box((0,1.61,.23),(.28,.07,.03),'DARK')
    m.wedge((0,1.72,-.02),(.08,.26,.20),'TEAM','Body',.25)
    for sign in (-1,1):
        m.lathe((sign*.38,1.16,0),[(-.10,.17),(.02,.23),(.12,.14)],'EDGE',10,depth=.84)
        m.box((sign*.40,.96,.02),(.18,.28,.18),'DARK')
    x=-.50; y=1.00
    for width,height,front,mat in [(.62,.82,.34,'EDGE'),(.54,.74,.37,'DARK'),(.46,.64,.39,'TEAM')]:
        w=width/2
        pts=[(x-w,y-.22,front),(x,y-height/2,front),(x+w,y-.22,front),(x+w,y+height/2,front),(x-w,y+height/2,front)]
        m.face('Body', mat, pts)
    m.box((x,y+.05,.42),(.06,.66,.03),'BRASS')
    m.box((x,y+.10,.42),(.42,.06,.03),'BRASS')
    m.lathe((x,y+.10,.44),[(-.03,.08),(.03,.08)],'BRASS',10,depth=.32)
    m.pivots['Weapon']=[.10,1.02,.08]
    m.lathe((0,-.04,.78),[(-.04,.05),(.04,.05)],'WOOD',8,'Weapon',depth=8.5)
    spear=[(-.08,-.02,1.55),(0,.14,1.90),(.08,-.02,1.55),(0,-.02,1.42)]
    m.prism_path(spear, thickness=.035, material='BRASS', name='Weapon', axis='x')
    spike=[(-.05,-.02,-.30),(0,.04,-.46),(.05,-.02,-.30),(0,-.02,-.20)]
    m.prism_path(spike, thickness=.025, material='EDGE', name='Weapon', axis='x')
    return m


def build_ranger():
    m = Model('Elemental Front Ranger polished prototype')
    common_legs(m, hip_x=.16, y0=.58, armored=False)
    m.lathe((0,0,0),[(.54,.22),(.80,.27),(1.08,.23)],'CLOTH',10,depth=.66)
    m.wedge((0,.96,.04),(.54,.42,.24),'LEATHER','Body',.68)
    m.box((0,.74,.00),(.56,.08,.28),'LEATHER')
    for sign in (-1,1):
        m.wedge((sign*.12,.55,-.12),(.18,.62,.16),'CLOTH','Body',.30,z_skew=-.06)
    m.lathe((0,0,0),[(1.12,.18),(1.34,.22),(1.50,.12)],'CLOTH',10,depth=.80)
    m.box((0,1.50,.18),(.20,.16,.06),'DARK')
    m.box((0,1.34,.16),(.10,.08,.05),'LEATHER')
    m.box((0,1.02,.18),(.34,.06,.03),'TEAM')
    m.box((-.22,1.16,.10),(.10,.28,.18),'TEAM')
    m.box((.34,1.02,-.10),(.16,.46,.18),'LEATHER')
    for z in (-.14,-.08,-.02,.04,.10):
        m.box((.36,1.18,z),(.03,.18,.03),'EDGE')
    m.box((.20,1.00,-.16),(.05,.72,.05),'LEATHER')
    for sign in (-1,1):
        m.box((sign*.34,.98,.05),(.14,.26,.14),'LEATHER')
    m.pivots['Weapon']=[-.42,1.00,.14]
    m.ring((0,1.02,.14),.42,.028,'BRASS','Weapon',vertical=True,segments=18,sides=5)
    m.box((-.42,1.02,.14),(.05,.70,.05),'WOOD','Weapon')
    m.box((-.42,.95,.14),(.08,.10,.08),'LEATHER','Weapon')
    m.box((.18,1.10,.18),(.05,.05,.42),'EDGE')
    return m


def build_engineer():
    m = Model('Elemental Front Engineer polished prototype')
    common_legs(m, hip_x=.17, y0=.60, armored=False)
    m.lathe((0,0,0),[(.58,.24),(.84,.30),(1.12,.26)],'DARK',10,depth=.70)
    m.wedge((0,.98,.04),(.58,.44,.28),'STEEL','Body',.70)
    m.box((0,.80,.04),(.60,.10,.34),'LEATHER')
    m.wedge((0,.58,.18),(.30,.56,.05),'TEAM','Body',.46)
    m.lathe((0,0,0),[(1.14,.19),(1.34,.22),(1.48,.12)],'STEEL',10,depth=.82)
    for x in (-.08,.08):
        m.lathe((x,1.48,.21),[(-.03,.05),(.03,.05)],'BRASS',8,depth=.45)
    m.box((0,1.47,.18),(.20,.04,.06),'DARK')
    m.box((.26,1.00,-.08),(.34,.46,.24),'BRASS')
    m.box((.26,1.02,-.22),(.24,.10,.06),'TEAM')
    m.box((-.26,.92,.10),(.18,.28,.18),'LEATHER')
    m.box((.38,.86,.10),(.16,.22,.16),'LEATHER')
    m.box((0,1.25,-.08),(.52,.06,.12),'BRASS')
    for sign in (-1,1):
        m.box((sign*.18,1.10,-.08),(.05,.34,.05),'BRASS')
    m.pivots['Weapon']=[-.42,.98,.12]
    m.box((-.42,.86,.12),(.10,.44,.10),'WOOD','Weapon')
    m.box((-.42,1.08,.12),(.30,.14,.18),'EDGE','Weapon')
    m.box((-.32,1.06,.12),(.10,.10,.24),'BRASS','Weapon')
    wrench=[(.46,1.18,-.04),(.60,1.26,-.04),(.54,1.12,-.04),(.66,1.08,-.04),(.50,1.02,-.04)]
    m.prism_path(wrench, thickness=.035, material='EDGE', name='Body', axis='z')
    return m


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    build_spear_guard().export(OUT / 'unit-spear-guard.glb')
    build_ranger().export(OUT / 'unit-ranger.glb')
    build_engineer().export(OUT / 'unit-engineer.glb')

if __name__ == '__main__':
    main()
