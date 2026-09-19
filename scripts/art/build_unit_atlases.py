#!/usr/bin/env python3
"""Losslessly pack committed frames; no art generation, scaling or direction edits."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SLUGS = ('vanguard', 'spear-guard', 'ranger', 'scout', 'elementalist-fire',
         'elementalist-water', 'elementalist-ice', 'elementalist-lightning',
         'engineer', 'golem', 'siege-construct')
ACTIONS = ('idle', 'move', 'attack', 'hit', 'death')
DIRECTIONS = ('front', 'front_left', 'left', 'rear_left', 'rear', 'rear_right', 'right', 'front_right')
WIDTH, HEIGHT, GUTTER, COLUMNS = 192, 256, 2, 8


def build():
    source = ROOT / 'public/assets/impostors'
    output = ROOT / 'public/assets/impostor-atlases'
    entries = []
    for slug in SLUGS:
        for action in ACTIONS:
            atlas = Image.new('RGBA', ((WIDTH + 2 * GUTTER) * COLUMNS, (HEIGHT + 2 * GUTTER) * 4))
            digest = hashlib.sha256()
            originals = []
            for direction, stem in enumerate(DIRECTIONS):
                for frame in range(4):
                    path = source / slug / action / f'{stem}_{frame:02d}.webp'
                    digest.update(path.read_bytes())
                    with Image.open(path) as image:
                        image = image.convert('RGBA')
                        if image.size != (WIDTH, HEIGHT) or image.getextrema()[3][1] == 0:
                            raise ValueError(f'Invalid frame: {path}')
                        index = direction * 4 + frame
                        x, y = (index % COLUMNS) * (WIDTH + 4) + GUTTER, (index // COLUMNS) * (HEIGHT + 4) + GUTTER
                        atlas.paste(image, (x, y))
                        # Extruded gutters prevent linear filtering into adjacent frames.
                        atlas.paste(image.crop((0, 0, 1, HEIGHT)).resize((2, HEIGHT)), (x - 2, y))
                        atlas.paste(image.crop((WIDTH - 1, 0, WIDTH, HEIGHT)).resize((2, HEIGHT)), (x + WIDTH, y))
                        atlas.paste(atlas.crop((x - 2, y, x + WIDTH + 2, y + 1)).resize((WIDTH + 4, 2)), (x - 2, y - 2))
                        atlas.paste(atlas.crop((x - 2, y + HEIGHT - 1, x + WIDTH + 2, y + HEIGHT)).resize((WIDTH + 4, 2)), (x - 2, y + HEIGHT))
                        originals.append((x, y, image.tobytes()))
            path = output / slug / f'{action}.webp'
            path.parent.mkdir(parents=True, exist_ok=True)
            atlas.save(path, 'WEBP', lossless=True, exact=True, method=6)
            with Image.open(path) as decoded:
                decoded = decoded.convert('RGBA')
                for x, y, original in originals:
                    if decoded.crop((x, y, x + WIDTH, y + HEIGHT)).tobytes() != original:
                        raise ValueError(f'Atlas pixel mismatch: {path}')
            entries.append({'slug': slug, 'action': action, 'sourceSha256': digest.hexdigest()})
    (output / 'manifest.json').write_text(json.dumps({
        'version': 1, 'frameWidth': WIDTH, 'frameHeight': HEIGHT, 'gutter': GUTTER,
        'columns': COLUMNS, 'rows': 4, 'directions': DIRECTIONS,
        'framesPerDirection': 4, 'packing': 'canonical-direction-major',
        'entries': entries,
    }, indent=2) + '\n')
    print(f'Built and pixel-verified {len(entries)} atlases from {len(entries) * 32} committed WebPs.')


def prune_dist():
    # Raw committed frames remain build inputs, not duplicated deployment payload.
    for slug in SLUGS:
        for action in ACTIONS:
            directory = ROOT / 'dist/assets/impostors' / slug / action
            if directory.is_dir():
                shutil.rmtree(directory)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prune-dist', action='store_true')
    args = parser.parse_args()
    prune_dist() if args.prune_dist else build()
