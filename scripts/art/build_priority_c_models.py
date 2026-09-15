"""Build Priority-C heavy unit GLBs for PEPEPOW Elemental Front.

Original faceted RTS meshes. Python standard library only.
Metres, Y up, +Z forward. TEAM is ownership tint; ELEMENT is arcane core glow.
"""
import json, math, struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "public/assets/models"
STEEL = (.29, .35, .39)
DARK_STEEL = (.16, .19, .21)
EDGE = (.58, .65, .66)
BRASS = (.62, .44, .20)
STONE = (.40, .43, .42)
DARK_STONE = (.24, .27, .27)
WOOD = (.25, .16, .08)
WHITE = (1, 1, 1)

class Model:
    def __init__(self):
        self.groups = {}
        self.pivots = {}

    def face(self, name, role, points, color):
        group = self.groups.setdefault((name, role), [[], [], []])
        a, b, c = points[:3]
        u = [b[i]-a[i] for i in range(3)]
        v = [c[i]-a[i] for i in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in n)) or 1
        n = [x/length for x in n]
        for i in range(1, len(points)-1):
            for p in [points[0], points[i], points[i+1]]:
                group[0].extend(p); group[1].extend(n); group[2].extend(color)

    def box(self, pos, size, color=STEEL, name="Body", role="SURFACE"):
        x,y,z = pos; a,b,c = [s/2 for s in size]
        p=[(x+i*a,y+j*b,z+k*c) for i,j,k in [
            (-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
            (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for f in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
            self.face(name, role, [p[i] for i in f], color)

    def lathe(self, pos, rings, color=STEEL, sides=8, name="Body", role="SURFACE", depth=1):
        x,y,z=pos
        rows=[[(x+r*math.sin(i*2*math.pi/sides), y+h, z+r*math.cos(i*2*math.pi/sides)*depth)
               for i in range(sides)] for h,r in rings]
        self.face(name,role,list(reversed(rows[0])),color)
        for lo,hi in zip(rows,rows[1:]):
            for i in range(sides):
                j=(i+1)%sides
                self.face(name,role,[lo[i],lo[j],hi[j],hi[i]],color)
        self.face(name,role,rows[-1],color)

    def ring(self, pos, radius, tube, color=BRASS, name="Body", role="SURFACE", vertical=False):
        x,y,z=pos
        def p(i,j):
            a=i*2*math.pi/24; b=j*2*math.pi/6
            q=((radius+tube*math.cos(b))*math.cos(a),tube*math.sin(b),(radius+tube*math.cos(b))*math.sin(a))
            return (x+q[0], y+(q[2] if vertical else q[1]), z+(q[1] if vertical else q[2]))
        for i in range(24):
            for j in range(6):
                pts=[p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)]
                self.face(name,role,pts if vertical else list(reversed(pts)),color)

    def export(self, filename, element=(.32,.82,.76)):
        data=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        def accessor(values):
            offset=len(data); data.extend(struct.pack("<"+"f"*len(values),*values))
            views.append({"buffer":0,"byteOffset":offset,"byteLength":len(values)*4})
            accessors.append({
                "bufferView":len(views)-1,"componentType":5126,"count":len(values)//3,"type":"VEC3",
                "min":[min(values[i::3]) for i in range(3)],
                "max":[max(values[i::3]) for i in range(3)]})
            return len(accessors)-1
        names={}
        for (name,role),arrays in self.groups.items():
            primitive={"attributes":dict(zip(["POSITION","NORMAL","COLOR_0"],[accessor(a) for a in arrays])),
                       "material":["SURFACE","TEAM","ELEMENT"].index(role)}
            if name in names:
                meshes[names[name]]["primitives"].append(primitive)
            else:
                names[name]=len(meshes)
                meshes.append({"name":name,"primitives":[primitive]})
                nodes.append({"name":name,"mesh":len(meshes)-1,"translation":self.pivots.get(name,[0,0,0])})
        materials=[
            {"name":"SURFACE","pbrMetallicRoughness":{"metallicFactor":.28,"roughnessFactor":.68}},
            {"name":"TEAM","pbrMetallicRoughness":{"baseColorFactor":[.08,.55,.45,1],"metallicFactor":.18,"roughnessFactor":.55}},
            {"name":"ELEMENT","pbrMetallicRoughness":{"baseColorFactor":[*element,1],"metallicFactor":.08,"roughnessFactor":.25},
             "emissiveFactor":list(element)}
        ]
        gltf={"asset":{"version":"2.0","generator":"Elemental Front Priority-C heavy-unit workshop"},
              "scene":0,"scenes":[{"nodes":list(range(len(nodes)))}],"nodes":nodes,"meshes":meshes,
              "materials":materials,"buffers":[{"byteLength":len(data)}],"bufferViews":views,"accessors":accessors}
        encoded=json.dumps(gltf,separators=(",",":")).encode(); encoded+=b" "*((-len(encoded))%4)
        data+=b"\0"*((-len(data))%4)
        blob=struct.pack("<III",0x46546c67,2,28+len(encoded)+len(data))+struct.pack("<II",len(encoded),0x4e4f534a)+encoded+struct.pack("<II",len(data),0x004e4942)+data
        (OUT/filename).write_bytes(blob)
        print(f"{filename}: {len(blob)//1024} KiB, {sum(len(g[0])//9 for g in self.groups.values())} triangles, {len(self.groups)} primitives")

def build_golem():
    m=Model()
    for sign,name in [(-1,"LegL"),(1,"LegR")]:
        m.pivots[name]=[sign*.42,.62,0]
        m.box((0,-.12,0),(.58,.72,.62),DARK_STONE,name)
        m.box((0,-.48,.08),(.74,.24,.88),STEEL,name)
        m.box((0,-.08,.34),(.32,.28,.08),WHITE,name,role="TEAM")
    m.lathe((0,0,0),[(.68,.56),(1.25,.76),(1.72,.66),(1.94,.48)],STONE,sides=8,depth=.82)
    m.box((0,1.35,-.34),(1.36,.22,.18),DARK_STEEL)
    for sign in [-1,1]:
        m.box((sign*.86,1.48,0),(.58,.54,.66),STEEL)
        m.box((sign*.88,1.50,.36),(.34,.25,.10),WHITE,role="TEAM")
    m.lathe((0,1.94,0),[(0,.30),(.24,.32),(.48,.24)],DARK_STEEL,sides=6,depth=.9)
    m.box((0,2.14,.235),(.33,.08,.05),WHITE,role="ELEMENT")
    m.box((-.98,1.04,.05),(.52,.86,.56),DARK_STONE)
    m.box((-.98,.58,.16),(.72,.38,.72),STEEL)
    m.pivots["Weapon"]=[.92,1.16,.02]
    m.box((0,-.10,0),(.36,.86,.40),DARK_STONE,"Weapon")
    m.box((0,-.58,.08),(.56,.38,.58),STEEL,"Weapon")
    m.box((0,.46,.12),(.92,.48,.58),STEEL,"Weapon")
    m.box((0,.47,.42),(.76,.14,.08),BRASS,"Weapon")
    m.lathe((0,1.42,.49),[(-.20,.22),(.20,.22)],WHITE,sides=6,role="ELEMENT")
    m.ring((0,1.42,.49),.29,.045,BRASS)
    m.export("unit-golem.glb",(.18,.88,.70))

def build_siege():
    m=Model()
    m.box((0,.56,0),(2.36,.62,2.52),DARK_STEEL)
    m.box((0,.86,-.08),(1.76,.42,1.62),STEEL)
    m.box((0,.92,.78),(1.36,.30,.42),WHITE,role="TEAM")
    for x in [-1.20,1.20]:
        for z in [-.78,.78]:
            m.lathe((x,.46,z),[(-.18,.48),(.18,.48)],DARK_STONE,sides=10,depth=.28)
            m.lathe((x,.46,z),[(-.20,.22),(.20,.22)],BRASS,sides=8,depth=.32)
    m.box((0,.62,-1.34),(1.40,.18,.50),WOOD)
    for x in [-.56,.56]:
        m.box((x,.38,-1.48),(.18,.42,.68),BRASS)
    m.pivots["Weapon"]=[0,1.15,.20]
    m.lathe((0,0,0),[(-.26,.62),(.22,.62)],STEEL,sides=10,name="Weapon",depth=.92)
    m.box((0,.02,.64),(.52,.40,1.38),DARK_STEEL,"Weapon")
    m.lathe((0,.02,1.62),[(-.16,.17),(.16,.17)],EDGE,sides=10,name="Weapon",depth=5.0)
    m.lathe((0,.02,2.45),[(-.20,.27),(.20,.27)],BRASS,sides=8,name="Weapon",depth=.72)
    m.lathe((0,1.15,-.62),[(-.24,.31),(.24,.31)],WHITE,sides=6,role="ELEMENT")
    m.ring((0,1.15,-.62),.38,.045,BRASS)
    m.box((-.72,1.48,-.84),(.10,1.05,.10),BRASS)
    m.box((-.48,1.72,-.84),(.56,.34,.06),WHITE,role="TEAM")
    m.export("unit-siege-construct.glb",(.30,.72,1.0))

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build_golem()
    build_siege()
