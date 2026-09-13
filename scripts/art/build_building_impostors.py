#!/usr/bin/env python3
"""Normalize canonical building art into 512x512 transparent WebP impostors."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Final

from PIL import Image, ImageChops

ROOT: Final = Path(__file__).resolve().parents[2]
SOURCE_ROOT: Final = ROOT / "art" / "building-source"
UPLOAD_ROOT: Final = ROOT / "art" / "building-upload" / "public" / "assets" / "buildings"

# Target visible heights preserve the intended RTS scale hierarchy while leaving
# transparent headroom for tall silhouettes and UI overlays.
TARGET_HEIGHTS: Final[dict[str, int]] = {
    "elemental-core": 430,
    "barracks": 320,
    "arcane-tower": 400,
    "workshop": 350,
    "outpost": 350,
    "extractor": 275,
    "mana-well": 290,
}

SUPPORTED_EXTENSIONS: Final = (".png", ".webp", ".jpg", ".jpeg")
CANVAS: Final = 512
BASELINE_Y: Final = 492
SIDE_MARGIN: Final = 18


def parse_color(value: str) -> tuple[int, int, int] | None:
    value = value.strip().lower()
    if value == "transparent":
        return None
    if value.startswith("#") and len(value) == 7:
        return tuple(int(value[i : i + 2], 16) for i in (1, 3, 5))
    raise argparse.ArgumentTypeError("background must be 'transparent' or #RRGGBB")


def find_source(slug: str) -> Path:
    directory = SOURCE_ROOT / slug
    for stem in ("building", slug):
        for extension in SUPPORTED_EXTENSIONS:
            candidate = directory / f"{stem}{extension}"
            if candidate.exists():
                return candidate
    if directory.exists():
        candidates = sorted(p for p in directory.iterdir() if p.suffix.lower() in SUPPORTED_EXTENSIONS)
        if len(candidates) == 1:
            return candidates[0]
    raise FileNotFoundError(f"Missing unique source image for {slug} under {directory}")


def key_background(image: Image.Image, rgb: tuple[int, int, int] | None) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgb is None:
        return rgba

    pixels = rgba.load()
    if pixels is None:
        return rgba
    tolerance = 28
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            distance = max(abs(r - rgb[0]), abs(g - rgb[1]), abs(b - rgb[2]))
            if distance <= tolerance:
                pixels[x, y] = (r, g, b, 0)
            elif distance <= tolerance * 2:
                fade = int(255 * (distance - tolerance) / tolerance)
                pixels[x, y] = (r, g, b, min(a, fade))
    return rgba


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    threshold = alpha.point(lambda value: 255 if value >= 8 else 0)
    bounds = threshold.getbbox()
    if bounds is None:
        raise ValueError("Source image has no visible pixels after background removal")
    return bounds


def normalize(slug: str, image: Image.Image) -> Image.Image:
    bounds = alpha_bounds(image)
    cropped = image.crop(bounds)

    max_width = CANVAS - SIDE_MARGIN * 2
    target_height = TARGET_HEIGHTS[slug]
    scale = min(target_height / cropped.height, max_width / cropped.width)
    width = max(1, round(cropped.width * scale))
    height = max(1, round(cropped.height * scale))
    resized = cropped.resize((width, height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - width) // 2
    y = BASELINE_Y - height
    if y < 8:
        raise ValueError(f"{slug} exceeds top safety margin after normalization")
    canvas.alpha_composite(resized, (x, y))
    return canvas


def build_slug(slug: str, background: tuple[int, int, int] | None) -> Path:
    source = find_source(slug)
    with Image.open(source) as opened:
        prepared = key_background(opened, background)
        output = normalize(slug, prepared)

    destination = UPLOAD_ROOT / slug / "building.webp"
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, format="WEBP", lossless=True, method=6)
    return destination


def validate(path: Path) -> None:
    if not path.exists() or path.stat().st_size == 0:
        raise ValueError(f"Missing/empty output: {path}")
    with Image.open(path) as image:
        if image.size != (CANVAS, CANVAS):
            raise ValueError(f"Unexpected dimensions for {path}: {image.size}")
        rgba = image.convert("RGBA")
        if alpha_bounds(rgba) is None:
            raise ValueError(f"No visible pixels in {path}")
        alpha = rgba.getchannel("A")
        if ImageChops.difference(alpha, Image.new("L", alpha.size, 255)).getbbox() is None:
            raise ValueError(f"Output has no transparency: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", type=parse_color, default=None, help="transparent or #RRGGBB")
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--init", action="store_true", help="create canonical source directories")
    args = parser.parse_args()

    if args.init:
        for slug in TARGET_HEIGHTS:
            (SOURCE_ROOT / slug).mkdir(parents=True, exist_ok=True)
        print(f"Initialized {len(TARGET_HEIGHTS)} source directories under {SOURCE_ROOT}")
        return

    for slug in TARGET_HEIGHTS:
        destination = UPLOAD_ROOT / slug / "building.webp"
        if not args.check_only:
            destination = build_slug(slug, args.background)
        validate(destination)
        print(f"OK {slug}: {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
