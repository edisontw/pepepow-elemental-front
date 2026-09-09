"""Reproducible, original faceted RTS meshes. Python standard library only.

Metres, Y up, +Z forward. Neutral surfaces carry vertex colors; TEAM is
replaceable independently of ELEMENT. Named rigid nodes support runtime motion.
This is a production baseline, not a claim of final artist-approved/rigged art.
"""
import json
import math
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'public/assets/models'
STEEL = (.29, .35, .39)
EDGE = (.58, .65, .66)
LEATHER = (.19, .13, .09)
CLOTH = (.13, .19, .22)
BRASS = (.62, .44, .20)
STONE = (.40, .43, .42)
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
                group[0].extend(p)
                group[1].extend(n)
                group[2].extend(color)

    def box(self, pos, size, color=STEEL, name='Body', role='SURFACE'):
        x,y,z=pos; a,b,c=[s/2 for s in size]
        p=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for f in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
            self.face(name,role,[p[i] for i in f],color)

    def lathe(self, pos, rings, color=STEEL, sides=8, name='Body', role='SURFACE', depth=1):
        # Counterclockwise rings seen from above, with outward-facing winding.
        x,y,z=pos
        rows=[[(x+r*math.sin(i*2*math.pi/sides),y+h,z+r*math.cos(i*2*math.pi/sides)*depth) for i in range(sides)] for h,r in rings]
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
            return (x+q[0],y+(q[2] if vertical else q[1]),z+(q[1] if vertical else q[2]))
        for i in range(24):
            for j in range(6):
                pts=[p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)]
                self.face(name,role,pts if vertical else list(reversed(pts)),color)

    def export(self, filename, element=(.45,.80,.95)):
        data=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
        def accessor(values):
            offset=len(data); data.extend(struct.pack('<'+'f'*len(values),*values))
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4})
            accessors.append({'bufferView':len(views)-1,'componentType':5126,'count':len(values)//3,'type':'VEC3','min':[min(values[i::3]) for i in range(3)],'max':[max(values[i::3]) for i in range(3)]})
            return len(accessors)-1
        names={}
        for (name,role),arrays in self.groups.items():
            primitive={'attributes':dict(zip(['POSITION','NORMAL','COLOR_0'],[accessor(a) for a in arrays])), 'material':['SURFACE','TEAM','ELEMENT'].index(role)}
            if name in names:
                meshes[names[name]]['primitives'].append(primitive)
            else:
                names[name]=len(meshes); meshes.append({'name':name,'primitives':[primitive]})
                nodes.append({'name':name,'mesh':len(meshes)-1,'translation':self.pivots.get(name,[0,0,0])})
        materials=[{'name':'SURFACE','pbrMetallicRoughness':{'metallicFactor':.25,'roughnessFactor':.65}}, {'name':'TEAM','pbrMetallicRoughness':{'baseColorFactor':[.08,.55,.45,1],'metallicFactor':.2,'roughnessFactor':.55}}, {'name':'ELEMENT','pbrMetallicRoughness':{'baseColorFactor':[*element,1],'metallicFactor':.1,'roughnessFactor':.25},'emissiveFactor':list(element)}]
        gltf={'asset':{'version':'2.0','generator':'Elemental Front original mesh workshop'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors}
        encoded=json.dumps(gltf,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4)
        data+=b'\0'*((-len(data))%4)
        blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data
        (OUT/filename).write_bytes(blob)
        print(f'{filename}: {len(blob)//1024} KiB, {sum(len(g[0])//9 for g in self.groups.values())} triangles, {len(self.groups)} primitives')


def infantry(caster=False, element='FIRE'):
    m=Model()
    for sign,name in [(-1,'LegL'),(1,'LegR')]:
        m.pivots[name]=[sign*.19,.70,0]
        m.box((0,-.18,0),(.24,.36,.25),CLOTH,name)
        m.lathe((0,-.49,0),[(-.12,.14),(.14,.16)],STEEL,name=name,depth=.8)
        m.box((0,-.62,.08),(.29,.15,.43),LEATHER,name)
    m.lathe((0,0,0),[(.68,.29),(.92,.34),(1.25,.41),(1.36,.29)],STEEL,depth=.65)
    m.box((0,.81,0),(.65,.12,.42),LEATHER)
    m.box((0,.82,.24),(.13,.13,.055),BRASS)
    m.lathe((0,0,0),[(1.39,.20),(1.65,.26),(1.77,.14)],STEEL,depth=.85)
    m.box((0,1.58,.218),(.34,.055,.025),(.045,.065,.07))
    m.box((0,1.47,.19),(.10,.14,.07),EDGE)
    for sign in [-1,1]:
        m.lathe((sign*.41,1.25,0),[(-.13,.20),(.05,.25),(.14,.13)],EDGE,depth=.85)
        m.box((sign*.43,1.04,0),(.23,.30,.26),LEATHER)
    m.box((-.42,1.35,.07),(.27,.07,.30),WHITE,role='TEAM')
    m.box((.13,1.08,.265),(.13,.44,.035),WHITE,role='TEAM')
    if not caster:
        # Broad asymmetric kite shield: dark rim, inset ownership panel, boss.
        for width,front,col,role in [(.66,.40,EDGE,'SURFACE'),(.55,.425,WHITE,'TEAM')]:
            x=-.51; y=.99; w=width/2
            m.face('Body',role,[(x-w,y-.20,front),(x,y-.51,front),(x+w,y-.20,front),(x+w,y+.36,front),(x-w,y+.36,front)],col)
        m.box((-.51,.99,.44),(.085,.60,.04),BRASS)
        m.box((-.51,1.14,.44),(.55,.065,.045),BRASS)
        m.pivots['Weapon']=[.47,1.06,.04]
        m.box((0,-.11,.06),(.16,.25,.20),LEATHER,'Weapon')
        m.box((0,-.10,.32),(.34,.07,.07),BRASS,'Weapon')
        m.lathe((0,-.1,.74),[(-.025,.12),(.025,.12)],EDGE,sides=4,name='Weapon',depth=3.6)
        m.box((0,1.73,0),(.10,.13,.36),WHITE,role='TEAM')
        m.export('unit-vanguard.glb')
    else:
        # Split field coat leaves feet visible; practical armored shoulders.
        for sign in [-1,1]:
            m.box((sign*.20,.61,-.15),(.30,.62,.18),CLOTH)
        m.box((-.30,.87,.20),(.18,.26,.17),BRASS)
        m.pivots['Weapon']=[.47,1.04,.12]
        m.lathe((0,0,0),[(-.88,.042),(.67,.042)],LEATHER,name='Weapon')
        m.lathe((0,0,0),[(.44,.11),(.60,.11)],BRASS,name='Weapon')
        if element=='FIRE':
            m.lathe((0,.80,0),[(-.21,.07),(0,.21),(.26,.025)],WHITE,sides=5,name='Weapon',role='ELEMENT')
            for sign in [-1,1]: m.box((sign*.23,.78,0),(.10,.40,.19),STEEL,'Weapon')
        elif element=='WATER':
            m.ring((0,.79,0),.25,.045,BRASS,'Weapon',vertical=True)
            m.lathe((0,.79,0),[(-.19,.05),(-.10,.15),(.10,.15),(.19,.04)],WHITE,name='Weapon',role='ELEMENT')
        elif element=='ICE':
            for sign in [-1,1]: m.lathe((sign*.12,.79,0),[(-.2,.075),(.15,.11),(.35,.001)],WHITE,sides=4,name='Weapon',role='ELEMENT')
        else:
            for sign in [-1,1]:
                m.box((sign*.17,.80,0),(.09,.56,.09),STEEL,'Weapon')
                m.lathe((sign*.17,.64,0),[(-.10,.095),(.1,.095)],EDGE,name='Weapon')
            m.lathe((0,.9,0),[(-.24,.001),(0,.13),(.24,.001)],WHITE,sides=4,name='Weapon',role='ELEMENT')
        colors={'FIRE':(1,.28,.035),'WATER':(.04,.83,.71),'ICE':(.60,.88,1),'LIGHTNING':(.70,.35,1)}
        m.export(f'unit-elementalist-{element.lower()}.glb',colors[element])


def core():
    m=Model()
    m.lathe((0,0,0),[(.02,1.98),(.20,1.98),(.32,1.78),(.66,1.78)],STONE)
    m.lathe((0,0,0),[(.66,1.63),(1.14,1.63),(1.30,1.45)],STEEL)
    m.lathe((0,0,0),[(1.30,1.46),(1.41,1.46)],WHITE,role='TEAM')
    for x in [-1.22,1.22]:
        for z in [-1.22,1.22]:
            m.lathe((x,0,z),[(.24,.34),(1.62,.28),(1.8,.38),(1.94,.38)],STONE,sides=4)
            m.box((x,1.04,z),(.20,1.58,.24),STEEL)
            m.lathe((x,0,z),[(1.94,.30),(2.12,.30)],WHITE,sides=4,role='TEAM')
            m.lathe((x,0,z),[(2.12,.16),(2.45,.12)],BRASS,sides=4)
    # Fortified portal, broad steps, visible dark entrance.
    m.box((0,.77,1.73),(.75,.94,.045),(.055,.065,.07))
    for x in [-.49,.49]: m.box((x,.75,1.77),(.21,1.04,.23),EDGE)
    m.box((0,1.31,1.77),(1.16,.18,.28),BRASS)
    for i in range(3): m.box((0,.08+i*.075,2.12-i*.15),(1.15,.16,.31),STONE)
    m.lathe((0,0,0),[(1.4,.71),(1.65,.59),(1.76,.59)],BRASS)
    m.pivots['Reactor']=[0,2.53,0]
    m.lathe((0,0,0),[(-.77,0),(-.34,.47),(.28,.40),(.92,0)],WHITE,sides=6,name='Reactor',role='ELEMENT')
    m.pivots['Orbit']=[0,2.51,0]
    m.ring((0,0,0),.96,.085,BRASS,'Orbit',vertical=True)
    m.ring((0,0,0),1.14,.065,EDGE,'Orbit')
    m.export('building-elemental-core.glb',(.34,.65,.90))


def unit_specialist(kind):
    """Readable light-weight specialist silhouettes sharing the Frontier body language."""
    m=Model()
    for sign,name in [(-1,'LegL'),(1,'LegR')]:
        m.pivots[name]=[sign*.16,.6,0]
        m.box((0,-.12,0),(.20,.32,.22),CLOTH,name)
        m.lathe((0,-.43,0),[(-.12,.12),(.12,.14)],STEEL,name=name,depth=.8)
        m.box((0,-.56,.08),(.26,.14,.34),LEATHER,name)
    m.lathe((0,0,0),[(.56,.25),(.82,.3),(1.12,.25)],STEEL,depth=.68)
    m.lathe((0,0,0),[(1.14,.18),(1.39,.22),(1.53,.12)],STEEL,depth=.82)
    m.box((0,1.34,.18),(.28,.08,.04),WHITE,role='TEAM')
    if kind == 'SPEAR_GUARD':
        m.box((-.35,1.01,.02),(.18,.26,.18),EDGE)
        m.pivots['Weapon']=[.08,1.02,.08]
        m.lathe((0,-.05,.72),[(-.04,.08),(.04,.08)],EDGE,sides=6,name='Weapon',depth=6.6)
        m.lathe((0,-.05,1.42),[(-.10,.16),(0,.03),(.22,.001)],BRASS,sides=4,name='Weapon',depth=1)
    elif kind == 'RANGER':
        m.box((-.31,.72,-.02),(.12,.64,.16),CLOTH)
        m.box((.31,.72,-.02),(.12,.64,.16),CLOTH)
        m.pivots['Weapon']=[-.38,1.02,.15]
        m.ring((0,1.05,.15),.38,.035,BRASS,'Weapon',vertical=True)
        m.box((-.38,1.05,.15),(.06,.62,.06),LEATHER,'Weapon')
        m.box((.39,.77,-.08),(.15,.35,.15),BRASS)
    elif kind == 'SCOUT':
        m.box((-.27,.64,-.12),(.18,.48,.14),CLOTH)
        m.box((.27,.64,-.12),(.18,.48,.14),CLOTH)
        m.pivots['Weapon']=[.34,.92,.12]
        m.lathe((.34,.92,.12),[(-.12,.11),(.12,.11)],BRASS,sides=6,name='Weapon',depth=2.8)
        m.box((-.35,1.03,.15),(.18,.22,.22),WHITE,role='TEAM')
        m.box((.32,1.2,.08),(.12,.12,.18),BRASS)
    else: # ENGINEER
        m.box((-.32,.72,-.02),(.22,.52,.22),CLOTH)
        m.box((.34,.76,.10),(.3,.42,.34),BRASS)
        m.box((.34,.80,.30),(.36,.10,.08),WHITE,role='TEAM')
        m.pivots['Weapon']=[-.4,1.0,.12]
        m.box((-.42,.93,.12),(.16,.42,.18),EDGE,'Weapon')
        m.box((-.42,.69,.12),(.26,.18,.28),BRASS,'Weapon')
    m.export(f'unit-{kind.lower().replace("_","-")}.glb')


def building(kind):
    m=Model()
    team=WHITE
    if kind == 'BARRACKS':
        m.box((0,.55,0),(2.55,1.05,2.05),STONE)
        m.box((0,1.18,0),(2.35,.26,1.85),STEEL)
        m.box((0,.5,1.08),(.82,.75,.08),team,role='TEAM')
        m.box((0,1.34,.12),(1.75,.10,.15),BRASS)
        for x in [-.88,.88]: m.box((x,1.22,-.72),(.18,.40,.18),BRASS)
    elif kind == 'ARCANE_TOWER':
        m.lathe((0,0,0),[(.02,1.08),(.35,1.0),(1.45,.78),(2.05,.7)],STONE,sides=8)
        m.ring((0,2.06,0),.82,.08,BRASS,'Body',vertical=False)
        m.lathe((0,2.06,0),[(-.35,.35),(.35,.35)],WHITE,sides=6,name='Body',role='ELEMENT')
        m.box((0,.48,.85),(.38,.8,.06),team,role='TEAM')
    elif kind == 'WORKSHOP':
        m.box((0,.58,0),(2.85,1.1,2.45),STONE)
        m.box((0,1.25,0),(2.68,.22,2.28),STEEL)
        m.box((0,.72,1.27),(1.35,.75,.06),team,role='TEAM')
        for x in [-.98,.98]: m.box((x,1.55,-.55),(.22,1.05,.22),BRASS)
        m.box((0,1.78,-.55),(2.18,.16,.22),BRASS)
    elif kind == 'OUTPOST':
        m.lathe((0,0,0),[(.02,1.05),(.38,1.08),(.72,.88)],STONE,sides=8)
        m.box((0,1.35,0),(.34,1.55,.34),team,role='TEAM')
        m.lathe((0,2.25,0),[(-.25,.22),(.25,.22)],WHITE,sides=6,name='Body',role='ELEMENT')
    elif kind == 'EXTRACTOR':
        m.lathe((0,0,0),[(.02,.88),(.35,.88),(.62,.7)],STEEL)
        m.lathe((0,.72,0),[(-.22,.38),(.22,.38)],WHITE,sides=6,role='ELEMENT')
        for x,z in [(-.72,0),(.72,0),(0,.72),(0,-.72)]: m.box((x,.55,z),(.75,.16,.16),BRASS)
    else: # MANA_WELL
        m.lathe((0,0,0),[(.02,.9),(.25,.9),(.44,.73)],STONE)
        m.ring((0,.62,0),.65,.07,BRASS,'Body')
        m.lathe((0,.78,0),[(-.35,.25),(.35,.25)],WHITE,sides=6,name='Body',role='ELEMENT')
        for angle in [0,2.094,4.188]:
            m.box((math.sin(angle)*.62,1.0,math.cos(angle)*.62),(.12,.72,.12),BRASS)
    m.export(f'building-{kind.lower().replace("_","-")}.glb',(.35,.65,.9))


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    infantry()
    for element in ['FIRE','WATER','ICE','LIGHTNING']: infantry(True,element)
    core()
    for kind in ['SPEAR_GUARD','RANGER','SCOUT','ENGINEER']: unit_specialist(kind)
    for kind in ['BARRACKS','ARCANE_TOWER','WORKSHOP','OUTPOST','EXTRACTOR','MANA_WELL']: building(kind)
