"""Build polished Priority-C heavy unit GLBs for PEPEPOW Elemental Front.

Presentation-only Arcane-Industrial Frontier assets. Python standard library only.
Metres, Y up, +Z forward. TEAM is ownership tint; ELEMENT is neutral arcane core glow.
The Golem preserves LegL/LegR/Weapon. Siege Construct preserves Weapon.
"""
import json, math, struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models'
STEEL = (.29, .35, .39)
DARK_STEEL = (.14, .17, .19)
EDGE = (.58, .65, .66)
BRASS = (.62, .44, .20)
STONE = (.38, .41, .40)
DARK_STONE = (.22, .25, .25)
WOOD = (.28, .18, .09)
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

    def box(self, pos, size, color=STEEL, name='Body', role='SURFACE'):
        x,y,z = pos; a,b,c = [s/2 for s in size]
        p=[(x+i*a,y+j*b,z+k*c) for i,j,k in [
            (-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
            (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for f in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
            self.face(name, role, [p[i] for i in f], color)

    def lathe(self, pos, rings, color=STEEL, sides=8, name='Body', role='SURFACE', depth=1):
        x,y,z=pos
        rows=[[(x+r*math.sin(i*2*math.pi/sides), y+h, z+r*math.cos(i*2*math.pi/sides)*depth)
               for i in range(sides)] for h,r in rings]
        self.face(name,role,list(reversed(rows[0])),color)
        for lo,hi in zip(rows,rows[1:]):
            for i in range(sides):
                j=(i+1)%sides
                self.face(name,role,[lo[i],lo[j],hi[j],hi[i]],color)
        self.face(name,role,rows[-1],color)

    def ring(self, pos, radius, tube, color=BRASS, name='Body', role='SURFACE', vertical=False):
        x,y,z=pos
        def p(i,j):
            a=i*2*math.pi/24; b=j*2*math.pi/6
            q=((radius+tube*math.cos(b))*math.cos(a),tube*math.sin(b),(radius+tube*math.cos(b))*math.sin(a))
            return (x+q[0], y+(q[2] if vertical else q[1]), z+(q[1] if vertical else q[2]))
        for i in range(24):
            for j in range(6):
                pts=[p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)]
                self.face(name,role,pts if vertical else list(reversed(pts)),color)

    def wheel_x(self, pos, radius=.52, width=.24, color=DARK_STONE, name='Body'):
        x,y,z = pos
        sides=12
        left=[(x-width/2, y+radius*math.cos(i*2*math.pi/sides), z+radius*math.sin(i*2*math.pi/sides)) for i in range(sides)]
        right=[(x+width/2, y+radius*math.cos(i*2*math.pi/sides), z+radius*math.sin(i*2*math.pi/sides)) for i in range(sides)]
        self.face(name,'SURFACE',list(reversed(left)),color)
        self.face(name,'SURFACE',right,color)
        for i in range(sides):
            j=(i+1)%sides
            self.face(name,'SURFACE',[left[i],left[j],right[j],right[i]],color)
        # Large cross spokes only: readable at RTS height, no tiny clutter.
        self.box((x,y,z), (width*.85, radius*1.62, .09), BRASS, name)
        self.box((x,y,z), (width*.85, .09, radius*1.62), BRASS, name)
        self.box((x,y,z), (width*1.15, .22, .22), STEEL, name)

    def export(self, filename, element=(.32,.82,.76)):
        data=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        def accessor(values):
            offset=len(data); data.extend(struct.pack('<'+'f'*len(values),*values))
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4})
            accessors.append({'bufferView':len(views)-1,'componentType':5126,'count':len(values)//3,'type':'VEC3',
                              'min':[min(values[i::3]) for i in range(3)], 'max':[max(values[i::3]) for i in range(3)]})
            return len(accessors)-1
        names={}
        for (name,role),arrays in self.groups.items():
            primitive={'attributes':dict(zip(['POSITION','NORMAL','COLOR_0'],[accessor(a) for a in arrays])),
                       'material':['SURFACE','TEAM','ELEMENT'].index(role)}
            if name in names:
                meshes[names[name]]['primitives'].append(primitive)
            else:
                names[name]=len(meshes)
                meshes.append({'name':name,'primitives':[primitive]})
                nodes.append({'name':name,'mesh':len(meshes)-1,'translation':self.pivots.get(name,[0,0,0])})
        materials=[
            {'name':'SURFACE','pbrMetallicRoughness':{'metallicFactor':.28,'roughnessFactor':.68}},
            {'name':'TEAM','pbrMetallicRoughness':{'baseColorFactor':[.08,.55,.45,1],'metallicFactor':.18,'roughnessFactor':.55}},
            {'name':'ELEMENT','pbrMetallicRoughness':{'baseColorFactor':[*element,1],'metallicFactor':.08,'roughnessFactor':.25},
             'emissiveFactor':list(element)}
        ]
        gltf={'asset':{'version':'2.0','generator':'Elemental Front polished Priority-C heavy units'},
              'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,
              'materials':materials,'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors}
        encoded=json.dumps(gltf,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4)
        data+=b'\0'*((-len(data))%4)
        blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data
        (OUT/filename).write_bytes(blob)
        print(f'{filename}: {len(blob)//1024} KiB, {sum(len(g[0])//9 for g in self.groups.values())} triangles, {len(self.groups)} primitives')


def build_golem():
    m=Model()
    # Short thick legs, visibly below human proportions.
    for sign,name in [(-1,'LegL'),(1,'LegR')]:
        m.pivots[name]=[sign*.43,.66,0]
        m.box((0,-.14,0),(.64,.72,.68),DARK_STONE,name)
        m.box((0,-.49,.08),(.78,.25,.90),STEEL,name)
        m.box((0,-.12,.34),(.36,.28,.08),WHITE,name,role='TEAM')
        m.box((0,-.16,-.31),(.52,.16,.09),BRASS,name)

    # Three huge stone torso blocks bound by iron bands.
    m.box((0,.92,0),(1.45,.56,.92),STONE)
    m.box((0,1.38,0),(1.62,.50,1.00),DARK_STONE)
    m.box((0,1.76,-.03),(1.42,.34,.88),STONE)
    m.box((0,1.18,.00),(1.72,.12,1.05),DARK_STEEL)
    m.box((0,1.64,.00),(1.60,.12,.98),DARK_STEEL)
    m.box((0,1.38,-.46),(1.48,.20,.12),BRASS)

    # Broad armored shoulders with large team-color plates.
    for sign in (-1,1):
        m.box((sign*.94,1.54,0),(.58,.58,.76),STEEL)
        m.box((sign*.97,1.58,.41),(.40,.30,.10),WHITE,role='TEAM')
        m.box((sign*.95,1.34,-.36),(.34,.12,.10),BRASS)

    # Low head embedded in upper torso, no robot face.
    m.box((0,1.92,.18),(.52,.28,.40),DARK_STONE)
    m.box((0,1.94,.40),(.32,.07,.05),DARK_STEEL)

    # Recessed neutral core with heavy protective ribs.
    m.lathe((0,1.42,.51),[(-.16,.20),(.16,.20)],WHITE,sides=8,role='ELEMENT',depth=.58)
    for x in (-.31,-.16,0,.16,.31):
        m.box((x,1.42,.55),(.07,.52,.08),DARK_STEEL)
    m.box((0,1.16,.54),(.78,.08,.09),BRASS)
    m.box((0,1.68,.54),(.78,.08,.09),BRASS)

    # Left massive arm / fist is static body geometry.
    m.box((-.99,1.05,.02),(.58,.82,.62),DARK_STONE)
    m.box((-.99,.60,.12),(.78,.42,.76),STEEL)
    m.box((-.99,.38,.26),(.70,.28,.66),DARK_STONE)

    # Right oversized forearm is the attack node.
    m.pivots['Weapon']=[.96,1.32,.02]
    m.box((0,-.20,0),(.58,.78,.62),DARK_STONE,'Weapon')
    m.box((0,-.61,.12),(.78,.44,.78),STEEL,'Weapon')
    m.box((0,-.84,.28),(.72,.30,.70),DARK_STONE,'Weapon')
    m.box((0,-.59,.50),(.52,.12,.10),BRASS,'Weapon')

    m.export('unit-golem.glb',(.18,.88,.70))


def build_siege():
    m=Model()
    # Low elongated timber-and-steel carriage; intentionally not a cannon/tank.
    m.box((0,.58,0),(2.20,.42,2.86),WOOD)
    m.box((0,.78,.10),(1.72,.34,2.08),DARK_STEEL)
    m.box((0,.86,1.05),(1.50,.30,.46),STEEL)
    m.box((0,.88,1.30),(1.32,.24,.12),WHITE,role='TEAM')
    m.box((0,.66,-1.18),(1.52,.18,.52),STEEL)

    # Four large reinforced side wheels with readable cross spokes.
    for x in (-1.18,1.18):
        for z in (-.88,.88):
            m.wheel_x((x,.50,z),radius=.55,width=.28)

    # Folded stabilizer outriggers on both sides.
    for x in (-1.05,1.05):
        m.box((x,.48,-1.30),(.18,.18,.88),BRASS)
        m.box((x,.38,-1.67),(.42,.16,.22),STEEL)

    # Exposed neutral focusing chamber in vulnerable middle section.
    m.lathe((0,1.00,-.20),[(-.23,.29),(.23,.29)],WHITE,sides=8,role='ELEMENT',depth=.72)
    m.ring((0,1.00,-.20),.38,.045,BRASS)
    for x in (-.44,.44):
        m.box((x,1.00,-.20),(.10,.62,.14),DARK_STEEL)

    # Twin torsion rails and counterweight housings remain body-mounted.
    for x in (-.55,.55):
        m.box((x,1.10,.05),(.22,.26,1.60),STEEL)
        m.box((x,1.10,-.72),(.42,.42,.42),DARK_STEEL)
        m.box((x,1.10,-.72),(.24,.24,.46),BRASS)

    # Weapon node: heavy twin throwing arms / arcane bombard sling.
    m.pivots['Weapon']=[0,1.10,.18]
    for x in (-.52,.52):
        m.box((x,.06,.28),(.20,.22,1.72),DARK_STEEL,'Weapon')
        m.box((x,.10,1.08),(.34,.30,.32),STEEL,'Weapon')
        m.box((x,.10,-.56),(.38,.34,.38),BRASS,'Weapon')
    m.box((0,.08,1.17),(1.18,.10,.12),EDGE,'Weapon')
    m.box((0,.08,1.30),(.52,.18,.38),BRASS,'Weapon')
    m.lathe((0,.08,1.34),[(-.09,.13),(.09,.13)],WHITE,sides=8,name='Weapon',role='ELEMENT',depth=.65)

    # Rear maintenance platform and simple team pennant plate.
    m.box((0,.78,-1.48),(1.34,.18,.42),WOOD)
    m.box((-.72,1.40,-1.34),(.09,1.05,.09),BRASS)
    m.box((-.50,1.70,-1.34),(.52,.30,.05),WHITE,role='TEAM')

    m.export('unit-siege-construct.glb',(.30,.72,1.0))


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    build_golem()
    build_siege()
