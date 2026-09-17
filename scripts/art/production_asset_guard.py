"""Prevent legacy generators from overwriting promoted manifest assets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def may_generate_fallback(path):
    path = Path(path).resolve()
    relative = path.relative_to(ROOT / 'public').as_posix()
    entries = json.loads((ROOT / 'data/assets/manifest.json').read_text())['entries']
    entry = next((item for item in entries if item.get('path') == relative), None)
    if entry is None:
        raise ValueError(f'No manifest entry for {relative}')
    if entry['status'] == 'NEEDS_MANUAL_GENERATION':
        return True
    if not path.is_file():
        raise FileNotFoundError(f'Promoted asset is missing: {relative}')
    print(f'Preserving promoted asset: {relative}')
    return False
