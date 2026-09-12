#!/usr/bin/env python3
"""Build canonical 8-direction WebP unit impostors into a manual-upload tree."""
from __future__ import annotations
import argparse, shutil, sys
from pathlib import Path
try:
    from PIL import Image, ImageChops
except ImportError as exc:
    raise SystemExit("Install Pillow: python -m pip install -r scripts/art/requirements-impostors.txt") from exc

CANVAS=(192,256); BASELINE=242; ALPHA_THRESHOLD=8
DIRECTIONS=("00-front","01-front-left","02-left","03-rear-left","04-rear","05-rear-right","06-right","07-front-right")
SLUGS=("vanguard","spear-guard","ranger","scout","elementalist-fire","elementalist-ice","elementalist-lightning","elementalist-water","engineer","golem","siege-construct")
EXTS=(".png",".webp",".jpg",".jpeg")
PACK={
 "vanguard":(.88,.90),"spear-guard":(.96,.94),"ranger":(.90,.90),"scout":(.88,.90),
 "elementalist-fire":(.92,.94),"elementalist-ice":(.92,.94),"elementalist-lightning":(.92,.94),"elementalist-water":(.92,.94),
 "engineer":(.90,.91),"golem":(.94,.94),"siege-construct":(.96,.84),
}

def source_path(root:Path,slug:str,direction:str)->Path:
    found=[root/slug/f"{direction}{ext}" for ext in EXTS if (root/slug/f"{direction}{ext}").is_file()]
    if len(found)!=1:
        raise RuntimeError(f"{slug}/{direction}: expected exactly one source ({', '.join(EXTS)}), found {len(found)}")
    return found[0]

def corner_key(rgb:Image.Image)->tuple[int,int,int]:
    w,h=rgb.size; n=max(2,min(w,h)//64); vals=[]
    for box in ((0,0,n,n),(w-n,0,w,n),(0,h-n,n,h),(w-n,h-n,w,h)):
        vals.extend(rgb.crop(box).getdata())
    vals.sort(key=sum)
    return vals[len(vals)//2]

def keyed_alpha(rgb:Image.Image,key:tuple[int,int,int],tol:int,feather:int)->Image.Image:
    diff=ImageChops.difference(rgb,Image.new("RGB",rgb.size,key)); r,g,b=diff.split()
    distance=ImageChops.lighter(ImageChops.lighter(r,g),b); hi=max(tol+feather,tol+1)
    return distance.point(lambda v: 0 if v<=tol else 255 if v>=hi else round((v-tol)*255/(hi-tol)))

def prepare(path:Path,bg:str,tol:int,feather:int)->tuple[Image.Image,tuple[int,int,int,int]]:
    with Image.open(path) as src: rgba=src.convert("RGBA")
    amin,_=rgba.getchannel("A").getextrema()
    if amin==255:
        if bg=="transparent": raise RuntimeError(f"{path}: fully opaque source; transparency required")
        rgb=rgba.convert("RGB"); key=corner_key(rgb) if bg=="auto" else tuple(int(bg[i:i+2],16) for i in (1,3,5))
        rgba.putalpha(keyed_alpha(rgb,key,tol,feather))
    mask=rgba.getchannel("A").point(lambda v:255 if v>ALPHA_THRESHOLD else 0); box=mask.getbbox()
    if box is None: raise RuntimeError(f"{path}: no visible content after background removal")
    l,t,r,b=box; pad=max(1,round(max(r-l,b-t)*.025))
    return rgba,(max(0,l-pad),max(0,t-pad),min(rgba.width,r+pad),min(rgba.height,b+pad))

def load_set(root:Path,slug:str,bg:str,tol:int,feather:int):
    return [(d,*prepare(source_path(root,slug,d),bg,tol,feather)) for d in DIRECTIONS]

def build_slug(src:Path,out:Path,slug:str,bg:str,tol:int,feather:int)->None:
    items=load_set(src,slug,bg,tol,feather)
    maxw=max(box[2]-box[0] for _,_,box in items); maxh=max(box[3]-box[1] for _,_,box in items)
    fw,fh=PACK[slug]; scale=min(CANVAS[0]*fw/maxw,min(CANVAS[1]*fh,BASELINE-5)/maxh)
    target=out/"public/assets/impostors"/slug; target.mkdir(parents=True,exist_ok=True)
    for direction,img,box in items:
        crop=img.crop(box); size=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
        crop=crop.resize(size,Image.Resampling.LANCZOS); canvas=Image.new("RGBA",CANVAS,(0,0,0,0))
        x=round((CANVAS[0]-size[0])/2); y=BASELINE-size[1]
        if x<0 or y<0 or x+size[0]>CANVAS[0]: raise RuntimeError(f"{slug}/{direction}: normalized frame exceeds canvas")
        canvas.alpha_composite(crop,(x,y)); path=target/f"{direction}.webp"; canvas.save(path,"WEBP",lossless=True,method=6)
        if path.stat().st_size==0: raise RuntimeError(f"{path}: empty output")
    print(f"built {slug}: 8 frames -> {target}")

def validate(out:Path,slugs:tuple[str,...])->None:
    problems=[]; expected={f"{d}.webp" for d in DIRECTIONS}
    for slug in slugs:
        target=out/"public/assets/impostors"/slug
        present={p.name for p in target.glob("*.webp") if p.is_file() and p.stat().st_size>0}
        if present!=expected: problems.append(f"{slug}: missing={sorted(expected-present)} extra={sorted(present-expected)}"); continue
        for name in expected:
            path=target/name
            try:
                with Image.open(path) as im:
                    if im.size!=CANVAS: problems.append(f"{slug}/{name}: size={im.size}")
                    if im.convert("RGBA").getchannel("A").getextrema()[0]==255: problems.append(f"{slug}/{name}: no transparent pixels")
            except Exception as exc: problems.append(f"{slug}/{name}: decode failed: {exc}")
    if problems: raise RuntimeError("Validation failed:\n"+"\n".join(problems))
    print(f"validated {len(slugs)} slug(s) / {len(slugs)*8} WebP frames")

def args()->argparse.Namespace:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source",type=Path,default=Path("art/impostor-source")); p.add_argument("--output",type=Path,default=Path("art/impostor-upload"))
    p.add_argument("--slug",choices=SLUGS,action="append"); p.add_argument("--init",action="store_true"); p.add_argument("--check-only",action="store_true"); p.add_argument("--clean",action="store_true")
    p.add_argument("--background",default="auto",help="auto, transparent, or #RRGGBB"); p.add_argument("--tolerance",type=int,default=12); p.add_argument("--feather",type=int,default=18)
    return p.parse_args()

def main()->int:
    a=args(); selected=tuple(a.slug) if a.slug else SLUGS
    if a.init:
        for slug in SLUGS: (a.source/slug).mkdir(parents=True,exist_ok=True)
        print(f"initialized source directories under {a.source}"); return 0
    if a.check_only: validate(a.output,selected); return 0
    if a.background not in ("auto","transparent") and not (len(a.background)==7 and a.background.startswith("#")):
        raise RuntimeError("--background must be auto, transparent, or #RRGGBB")
    if not 0<=a.tolerance<=255 or not 1<=a.feather<=255: raise RuntimeError("invalid tolerance/feather")
    if a.clean:
        for slug in selected: shutil.rmtree(a.output/"public/assets/impostors"/slug,ignore_errors=True)
    for slug in selected: build_slug(a.source,a.output,slug,a.background,a.tolerance,a.feather)
    validate(a.output,selected); return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except (RuntimeError,ValueError,OSError) as exc:
        print(f"ERROR: {exc}",file=sys.stderr); raise SystemExit(2) from exc
